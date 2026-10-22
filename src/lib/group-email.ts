import { escapeHtml, emailPalette, FONT_DISPLAY } from "@/lib/email-theme";
import { button, emailWindow } from "@/lib/engagement-email";
import type { EmailParts } from "@/lib/extras-email";

/** Correo de invitación a un grupo (ver sendGroupInvites en src/lib/groups.ts). */

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

export function groupInviteEmail({
  name,
  adminName,
  groupName,
  url,
}: {
  name: string;
  adminName: string;
  groupName: string;
  url: string;
}): EmailParts {
  return {
    subject: `💌 Te invitaron al grupo ${groupName}`,
    html: emailWindow({
      title: "💌&nbsp; Invitación",
      body: `
              ${p(`Hola ${escapeHtml(name)},`, 14)}
              ${big(`Te invitaron a ${escapeHtml(groupName)}`)}
              ${p(`<strong>${escapeHtml(adminName)}</strong> quiere que te sumes al grupo <strong>${escapeHtml(groupName)}</strong>. Si te unes, vas a recibir su boletín y podrás mandarle tus respuestas del día.`)}
              ${p("Tus otros grupos siguen igual: al responder eliges a cuáles mandar tu respuesta.")}
              ${button(url, "Unirme al grupo →")}
              ${faint("MSN status: 👥 hay alguien nuevo en la lista")}`,
    }),
    text: `Hola ${name},\n\nTe invitaron a ${groupName}.\n\n${adminName} quiere que te sumes al grupo ${groupName}. Si te unes, vas a recibir su boletín y podrás mandarle tus respuestas del día.\n\nTus otros grupos siguen igual: al responder eliges a cuáles mandar tu respuesta.\n\nUnirme al grupo: ${url}`,
  };
}
