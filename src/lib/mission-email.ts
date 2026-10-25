import { escapeHtml, emailPalette, FONT_DISPLAY } from "@/lib/email-theme";
import { button, emailWindow } from "@/lib/engagement-email";
import type { EmailParts } from "@/lib/extras-email";

/** Correos de misiones: advertencia por no cumplir, baneo y aviso al admin de una cancelación (ver src/lib/missions.ts). */

const l = emailPalette;

function p(text: string, size = 15): string {
  return `<p class="text-ink" style="margin:0 0 14px;color:${l.ink};font-size:${size}px;line-height:1.6;">${text}</p>`;
}

function big(text: string): string {
  return `<p class="text-pink" style="margin:0 0 12px;color:${l.pink};font-family:${FONT_DISPLAY};font-weight:700;font-size:22px;line-height:1.3;">${text}</p>`;
}

function quote(text: string): string {
  return `<p class="text-ink" style="margin:0 0 14px;padding:4px 0 4px 12px;border-left:3px solid ${l.pink};color:${l.ink};font-size:15px;line-height:1.6;font-style:italic;">${text}</p>`;
}

export function missionStrikeEmail({
  name,
  mission,
  strikes,
  maxStrikes,
  bannedUntil,
  url,
}: {
  name: string;
  /** Texto de la misión ya con el nombre de la persona. */
  mission: string;
  strikes: number;
  maxStrikes: number;
  /** Fecha legible hasta la que queda fuera; null si todavía no llega al límite. */
  bannedUntil: string | null;
  url: string;
}): EmailParts {
  const subject = bannedUntil
    ? "🚫 Te quedaste sin misiones por una semana"
    : `⚠️ Advertencia ${strikes} de ${maxStrikes}: misión sin cumplir`;
  const headline = bannedUntil ? "Una semana sin misiones" : `Advertencia ${strikes} de ${maxStrikes}`;
  const detail = bannedUntil
    ? `Juntaste ${maxStrikes} advertencias, así que hasta el <strong>${escapeHtml(bannedUntil)}</strong> no puedes aceptar misiones ni salir como persona de una. Después empiezas de cero.`
    : `Si llegas a ${maxStrikes}, te quedas una semana sin misiones. Si una misión se complica, cancélala desde Misiones antes de que cierre tu resumen: cancelar no cuenta como advertencia.`;
  const detailText = bannedUntil
    ? `Juntaste ${maxStrikes} advertencias, así que hasta el ${bannedUntil} no puedes aceptar misiones ni salir como persona de una. Después empiezas de cero.`
    : `Si llegas a ${maxStrikes}, te quedas una semana sin misiones. Si una misión se complica, cancélala desde Misiones antes de que cierre tu resumen: cancelar no cuenta como advertencia.`;
  return {
    subject,
    html: emailWindow({
      title: "🎯&nbsp; Misiones",
      body: `
              ${p(`Hola ${escapeHtml(name)},`, 14)}
              ${big(headline)}
              ${p("Esta misión se quedó sin entregar en tu resumen:")}
              ${quote(escapeHtml(mission))}
              ${p(detail)}
              ${button(url, "Ir a Misiones →")}`,
    }),
    text: `Hola ${name},\n\n${headline}\n\nEsta misión se quedó sin entregar en tu resumen:\n"${mission}"\n\n${detailText}\n\nIr a Misiones: ${url}`,
  };
}

export function missionCancelledAdminEmail({
  adminName,
  who,
  target,
  mission,
  url,
}: {
  adminName: string;
  who: string;
  target: string;
  mission: string;
  url: string;
}): EmailParts {
  return {
    subject: `🎯 ${who} canceló una misión`,
    html: emailWindow({
      title: "🎯&nbsp; Misión cancelada",
      body: `
              ${p(`Hola ${escapeHtml(adminName)},`, 14)}
              ${p(`<strong>${escapeHtml(who)}</strong> canceló una misión que había aceptado para <strong>${escapeHtml(target)}</strong>:`)}
              ${quote(escapeHtml(mission))}
              ${p("No cuenta como advertencia. Puedes ver todas las misiones en el panel.")}
              ${button(url, "Ver misiones →")}`,
    }),
    text: `Hola ${adminName},\n\n${who} canceló una misión que había aceptado para ${target}:\n"${mission}"\n\nNo cuenta como advertencia. Puedes ver todas las misiones en el panel: ${url}`,
  };
}
