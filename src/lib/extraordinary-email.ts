import { escapeHtml, emailPalette, FONT_DISPLAY } from "@/lib/email-theme";
import { button, emailWindow } from "@/lib/engagement-email";
import { formatLocalDate } from "@/lib/date";
import type { EmailParts } from "@/lib/extras-email";

/**
 * Correos de las respuestas extraordinarias (ver src/lib/extraordinary.ts):
 * el privilegio a quien se lo dan, el aviso al grupo de que un boletín
 * pasado cambió y el aviso a los admins de que alguien lo usó.
 */

const l = emailPalette;

function p(text: string, size = 15): string {
  return `<p class="text-ink" style="margin:0 0 14px;color:${l.ink};font-size:${size}px;line-height:1.6;">${text}</p>`;
}

function big(text: string): string {
  return `<p class="text-pink" style="margin:0 0 12px;color:${l.pink};font-family:${FONT_DISPLAY};font-weight:700;font-size:22px;line-height:1.3;">${text}</p>`;
}

function faint(text: string): string {
  return `<p class="text-faint" style="margin:22px 0 0;color:${l.faint};font-size:12px;line-height:1.5;">${text}</p>`;
}

export function grantEmail({
  name,
  adminName,
  date,
  newsletterName,
  url,
}: {
  name: string;
  adminName: string;
  date: string;
  newsletterName: string;
  url: string;
}): EmailParts {
  const day = formatLocalDate(date);
  return {
    subject: `👑 Tienes un privilegio especial en ${newsletterName}`,
    html: emailWindow({
      title: "👑&nbsp; Privilegio especial",
      body: `
              ${p(`Hola ${escapeHtml(name)},`, 14)}
              ${big("Te eligieron para un privilegio especial")}
              ${p(`<strong>${escapeHtml(adminName)}</strong>, admin de ${escapeHtml(newsletterName)}, te concede algo que casi nadie tiene: solo tú, y solamente tú, puedes enviar una <strong>respuesta extraordinaria</strong> al boletín del <strong>${escapeHtml(day)}</strong>.`)}
              ${p("Ese día la app te falló y tu respuesta no llegó. Esta es la forma de compensarlo: lo que mandes se agrega al boletín de ese día en el sitio, como si hubiera llegado a tiempo.")}
              ${p("Es de un solo uso, así que tómate tu tiempo. ✨")}
              ${button(url, "Usar mi privilegio →")}
              ${faint("MSN status: 👑 VIP")}`,
    }),
    text: `Hola ${name},\n\nTe eligieron para un privilegio especial.\n\n${adminName}, admin de ${newsletterName}, te concede algo que casi nadie tiene: solo tú, y solamente tú, puedes enviar una respuesta extraordinaria al boletín del ${day}.\n\nEse día la app te falló y tu respuesta no llegó. Lo que mandes se agrega al boletín de ese día en el sitio, como si hubiera llegado a tiempo.\n\nEs de un solo uso, así que tómate tu tiempo.\n\nUsar mi privilegio: ${url}`,
  };
}

/** Para el grupo: no dice quién respondió, solo que el boletín cambió. */
export function boletinUpdatedEmail({ name, date, boletinUrl }: { name: string; date: string; boletinUrl: string }): EmailParts {
  const day = formatLocalDate(date);
  return {
    subject: `📰 Hay actualizaciones en el boletín del ${day}`,
    html: emailWindow({
      title: "📰&nbsp; Boletín actualizado",
      body: `
              ${p(`Hola ${escapeHtml(name)},`, 14)}
              ${big(`Hay actualizaciones en el boletín del ${escapeHtml(day)}`)}
              ${p("Llegó una respuesta nueva a un boletín que ya había pasado. Date una vuelta, puede que te hayas perdido algo. 👀")}
              ${button(boletinUrl, "Ver boletín →")}
              ${faint("MSN status: 🆕 algo cambió por aquí")}`,
    }),
    text: `Hola ${name},\n\nHay actualizaciones en el boletín del ${day}.\n\nLlegó una respuesta nueva a un boletín que ya había pasado. Date una vuelta, puede que te hayas perdido algo.\n\n${boletinUrl}`,
  };
}

/** Para los admins: con el nombre de quien usó su privilegio. */
export function grantUsedEmail({
  name,
  userName,
  date,
  boletinUrl,
}: {
  name: string;
  userName: string;
  date: string;
  boletinUrl: string;
}): EmailParts {
  const day = formatLocalDate(date);
  return {
    subject: `👑 ${userName} usó su respuesta extraordinaria`,
    html: emailWindow({
      title: "👑&nbsp; Privilegio usado",
      body: `
              ${p(`Hola ${escapeHtml(name)},`, 14)}
              ${p(`<strong>${escapeHtml(userName)}</strong> mandó su respuesta extraordinaria para el boletín del <strong>${escapeHtml(day)}</strong>.`)}
              ${p("Al resto del grupo le avisamos que hay actualizaciones en ese boletín, sin decir de quién.")}
              ${button(boletinUrl, "Ver boletín →")}
              ${faint("MSN status: 🛠️ solo para admins")}`,
    }),
    text: `Hola ${name},\n\n${userName} mandó su respuesta extraordinaria para el boletín del ${day}.\n\nAl resto del grupo le avisamos que hay actualizaciones en ese boletín, sin decir de quién.\n\n${boletinUrl}`,
  };
}
