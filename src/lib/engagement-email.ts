import {
  escapeHtml,
  emailThemeHead,
  emailPalette,
  flatBg,
  winButtons,
  FONT_DISPLAY,
  FONT_BODY,
} from "@/lib/email-theme";
import type { UserStats } from "@/lib/participation-stats";

/** Ventanita con barra de título, igual que el recordatorio. */
function emailWindow({ title, body, width = 440 }: { title: string; body: string; width?: number }): string {
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

function button(href: string, label: string): string {
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

export type WeeklyHighlight = { icon: string; label: string; text: string };

/** Lo que va en el resumen semanal; es igual para todos menos el saludo y "tu semana". */
export type WeeklySummaryContent = {
  newsletterName: string;
  periodLabel: string;
  groupResponses: number;
  groupEligible: number;
  ranking: UserStats[];
  highlights: WeeklyHighlight[];
};

function pct(responses: number, eligible: number): string {
  return eligible ? `${Math.round((responses / eligible) * 100)}%` : "—";
}

function personalLine(me: UserStats | undefined): string {
  if (!me || me.eligibleDays === 0) return "";
  if (me.responses === me.eligibleDays) return `Tú respondiste todos los días (${me.responses} de ${me.eligibleDays}). Eres de los importantes 💖`;
  if (me.responses === 0) return `Tú no respondiste ningún día esta semana (0 de ${me.eligibleDays}). Te extrañamos 🥲`;
  return `Tú respondiste ${me.responses} de ${me.eligibleDays} días.`;
}

export function weeklySummaryEmailHtml({
  name,
  userId,
  content,
  siteUrl,
}: {
  name: string;
  userId: string;
  content: WeeklySummaryContent;
  siteUrl: string;
}): string {
  const l = emailPalette;
  const me = content.ranking.find((u) => u.id === userId);
  const mine = personalLine(me);

  const rows = content.ranking
    .map((u) => {
      const ratio = u.eligibleDays ? u.responses / u.eligibleDays : 0;
      // Barra con dos celdas (lleno + resto) — lo único que se ve igual en
      // Gmail, Outlook y Apple Mail. Al menos 1% para que la celda exista.
      const filled = Math.max(1, Math.round(ratio * 100));
      const bar =
        ratio > 0
          ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
              <td width="${filled}%" height="12" class="bg-titlebar" style="${flatBg(l.titlebar)}border-radius:0 4px 4px 0;font-size:0;line-height:0;">&nbsp;</td>
              ${filled < 100 ? `<td height="12" style="font-size:0;line-height:0;">&nbsp;</td>` : ""}
            </tr></table>`
          : "";
      const isMe = u.id === userId;
      return `<tr>
              <td style="padding:5px 8px 5px 0;font-size:13px;color:${l.ink};${isMe ? "font-weight:700;" : ""}white-space:nowrap;" class="text-ink">${escapeHtml(u.name)}</td>
              <td width="55%" class="bg-panel2" style="padding:0;${flatBg(l.panel2)}">${bar}</td>
              <td align="right" style="padding:5px 0 5px 8px;font-size:12px;color:${l.soft};white-space:nowrap;" class="text-soft">${u.responses}/${u.eligibleDays}</td>
            </tr>`;
    })
    .join("");

  const highlights = content.highlights
    .map(
      (h) =>
        `<tr><td style="padding:3px 8px 3px 0;font-size:16px;vertical-align:top;">${h.icon}</td><td style="padding:3px 0;font-size:14px;line-height:1.5;color:${l.ink};" class="text-ink"><strong>${escapeHtml(h.label)}:</strong> ${escapeHtml(h.text)}</td></tr>`
    )
    .join("");

  return emailWindow({
    title: "📊&nbsp; Resumen semanal",
    width: 520,
    body: `
              <p class="text-ink" style="margin:0 0 6px;color:${l.ink};font-family:${FONT_DISPLAY};font-weight:700;font-size:19px;">${escapeHtml(content.newsletterName)}</p>
              <p class="text-ink" style="margin:0 0 18px;color:${l.ink};font-size:14px;line-height:1.6;">Hola ${escapeHtml(name)}, así estuvo la participación del grupo ${escapeHtml(content.periodLabel)}:</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="bg-bubble" style="${flatBg(l.bubble)}border-radius:12px;margin:0 0 18px;">
                <tr><td style="padding:14px 18px;">
                  <p class="text-soft" style="margin:0;color:${l.soft};font-size:12px;font-weight:700;">Participación del grupo</p>
                  <p class="text-ink" style="margin:2px 0;color:${l.ink};font-family:${FONT_DISPLAY};font-weight:700;font-size:30px;">${pct(content.groupResponses, content.groupEligible)}</p>
                  <p class="text-soft" style="margin:0;color:${l.soft};font-size:12px;">${content.groupResponses} respuestas de ${content.groupEligible} posibles</p>
                </td></tr>
              </table>
              ${mine ? `<p class="text-ink" style="margin:0 0 18px;color:${l.ink};font-size:14px;line-height:1.6;">${escapeHtml(mine)}</p>` : ""}
              ${highlights ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">${highlights}</table>` : ""}
              <p class="text-ink" style="margin:0 0 8px;color:${l.ink};font-family:${FONT_DISPLAY};font-weight:700;font-size:15px;">Días respondidos por persona</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">${rows}</table>
              ${button(siteUrl, "Ir al sitio →")}
              <p class="text-faint" style="margin:22px 0 0;color:${l.faint};font-size:12px;line-height:1.5;">Solo cuentan los días en que salió el boletín. MSN status: 🟢 en línea</p>`,
  });
}

export function weeklySummaryEmailText({
  name,
  userId,
  content,
  siteUrl,
}: {
  name: string;
  userId: string;
  content: WeeklySummaryContent;
  siteUrl: string;
}): string {
  const me = content.ranking.find((u) => u.id === userId);
  const mine = personalLine(me);
  const lines = [
    `Hola ${name}, así estuvo la participación del grupo ${content.periodLabel}:`,
    "",
    `Participación del grupo: ${pct(content.groupResponses, content.groupEligible)} (${content.groupResponses} respuestas de ${content.groupEligible} posibles)`,
    ...(mine ? ["", mine] : []),
    "",
    ...content.highlights.map((h) => `${h.icon} ${h.label}: ${h.text}`),
    "",
    "Días respondidos por persona:",
    ...content.ranking.map((u) => `- ${u.name}: ${u.responses}/${u.eligibleDays}`),
    "",
    siteUrl,
  ];
  return lines.join("\n");
}
