import { escapeHtml, emailPalette, flatBg, FONT_DISPLAY } from "@/lib/email-theme";
import { button, emailWindow } from "@/lib/engagement-email";
import { responseDetailsHtml, responseDetailsText, capitalize, type NewsletterResponse } from "@/lib/newsletter";
import { formatLocalDate } from "@/lib/date";

/**
 * Correos especiales: racha, "hace un año", aniversario en el grupo,
 * resumen anual y bienvenida. Cada uno devuelve asunto, HTML y texto.
 */

export type EmailParts = { subject: string; html: string; text: string };

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

/** Cuadrícula de datos (2 columnas) para aniversario y resumen anual. */
function statGrid(stats: { label: string; value: string }[]): string {
  const cells = stats.map(
    (s) => `<td width="50%" valign="top" class="bg-bubble" style="${flatBg(l.bubble)}border-radius:10px;padding:10px 12px;">
        <p class="text-soft" style="margin:0;color:${l.soft};font-size:11.5px;font-weight:700;">${escapeHtml(s.label)}</p>
        <p class="text-ink" style="margin:2px 0 0;color:${l.ink};font-family:${FONT_DISPLAY};font-weight:700;font-size:17px;line-height:1.3;">${escapeHtml(s.value)}</p>
      </td>`
  );
  const rows: string[] = [];
  for (let i = 0; i < cells.length; i += 2) {
    rows.push(`<tr>${cells[i]}<td width="8" style="font-size:0;">&nbsp;</td>${cells[i + 1] ?? `<td width="50%"></td>`}</tr>
      <tr><td colspan="3" height="8" style="font-size:0;line-height:0;">&nbsp;</td></tr>`);
  }
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 10px;">${rows.join("")}</table>`;
}

// ---------------------------------------------------------------------------
// 🔥 Racha

const STREAK_LINES: Record<number, string> = {
  7: "Una semana entera sin fallar.",
  30: "Un mes completo. Esto ya es un hábito.",
  50: "Cincuenta días. Medio centenar de llegadas a casa.",
  100: "CIEN días seguidos. Leyenda del newsletter.",
  200: "Doscientos días. Ya eres parte del mobiliario.",
  365: "Un año entero sin fallar un solo día. No hay palabras.",
};

export function streakEmail({ name, days, siteUrl }: { name: string; days: number; siteUrl: string }): EmailParts {
  const line = STREAK_LINES[days] ?? "Sigue así.";
  return {
    subject: `🔥 ¡${days} días seguidos, ${name}!`,
    html: emailWindow({
      title: "🔥&nbsp; Racha",
      body: `${p(`Hola ${escapeHtml(name)},`, 14)}
        ${big(`¡Llevas ${days} días seguidos respondiendo!`)}
        ${p(`${escapeHtml(line)} Eres de los importantes de verdad 💖`)}
        ${button(siteUrl, "Seguir la racha →")}
        ${faint("MSN status: 🟢 en línea (siempre)")}`,
    }),
    text: `Hola ${name},\n\n¡Llevas ${days} días seguidos respondiendo! ${line} Eres de los importantes de verdad.\n\n${siteUrl}`,
  };
}

// ---------------------------------------------------------------------------
// 📅 Hace un año

export function onThisDayEmail({
  name,
  date,
  response,
  reactions,
  comments,
  siteUrl,
}: {
  name: string;
  date: string;
  response: Omit<NewsletterResponse, "userName">;
  reactions: number;
  comments: number;
  siteUrl: string;
}): EmailParts {
  const dateLabel = capitalize(formatLocalDate(date));
  const counts = [
    reactions ? `${reactions} ${reactions === 1 ? "reacción" : "reacciones"}` : "",
    comments ? `${comments} ${comments === 1 ? "comentario" : "comentarios"}` : "",
  ]
    .filter(Boolean)
    .join(" y ");
  return {
    subject: "📅 Hace un año…",
    html: emailWindow({
      title: "📅&nbsp; Hace un año",
      body: `${p(`Hola ${escapeHtml(name)},`, 14)}
        ${p(`Un día como hoy, hace un año (${escapeHtml(dateLabel)}), esto fue lo que contaste:`)}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;"><tr>
          <td class="bg-bubble border-edge" style="${flatBg(l.bubble)}border:1px solid ${l.edge};border-radius:14px;padding:11px 14px;">${responseDetailsHtml(response)}</td>
        </tr></table>
        ${counts ? p(`Recibió ${counts}.`, 13) : ""}
        ${p("¿Qué tanto ha cambiado? Cuéntanos qué harás hoy 👇", 14)}
        ${button(siteUrl, "Responder hoy →")}
        ${faint("MSN status: 🟡 recordando viejos tiempos")}`,
    }),
    text: [
      `Hola ${name},`,
      "",
      `Un día como hoy, hace un año (${dateLabel}), esto fue lo que contaste:`,
      ...responseDetailsText(response),
      ...(counts ? ["", `Recibió ${counts}.`] : []),
      "",
      `¿Qué tanto ha cambiado? Cuéntanos qué harás hoy: ${siteUrl}`,
    ].join("\n"),
  };
}

// ---------------------------------------------------------------------------
// 🎂 Aniversario en el grupo

export function anniversaryEmail({
  name,
  years,
  newsletterName,
  responses,
  longestStreak,
  reactionsReceived,
  siteUrl,
}: {
  name: string;
  years: number;
  newsletterName: string;
  responses: number;
  longestStreak: number;
  reactionsReceived: number;
  siteUrl: string;
}): EmailParts {
  const yearsLabel = `${years} ${years === 1 ? "año" : "años"}`;
  return {
    subject: `🎂 Hoy cumples ${yearsLabel} en ${newsletterName}`,
    html: emailWindow({
      title: "🎂&nbsp; Aniversario",
      body: `${p(`Hola ${escapeHtml(name)},`, 14)}
        ${big(`¡Hoy cumples ${yearsLabel} en el newsletter de los importantes!`)}
        ${p("Gracias por contarnos qué haces al llegar a casa. Esto es lo que llevas:")}
        ${statGrid([
          { label: "Respuestas", value: String(responses) },
          { label: "Mejor racha", value: `${longestStreak} días` },
          { label: "Reacciones recibidas", value: String(reactionsReceived) },
          { label: "Tiempo en el grupo", value: yearsLabel },
        ])}
        ${button(siteUrl, "Ir al sitio →")}
        ${faint("MSN status: 🎉 de fiesta")}`,
    }),
    text: `Hola ${name},\n\n¡Hoy cumples ${yearsLabel} en el newsletter de los importantes!\n\nRespuestas: ${responses}\nMejor racha: ${longestStreak} días\nReacciones recibidas: ${reactionsReceived}\n\n${siteUrl}`,
  };
}

// ---------------------------------------------------------------------------
// 🎁 Resumen anual

export type WrappedData = {
  name: string;
  year: number;
  newsletterName: string;
  responses: number;
  eligibleDays: number;
  longestStreak: number;
  typicalTime: string | null;
  topFood: string | null;
  reactionsGiven: number;
  reactionsReceived: number;
  commentsGiven: number;
  photos: number;
  fan: string | null;
  favorite: string | null;
  bestMoment: { date: string; score: number } | null;
  groupRate: string;
  groupResponses: number;
  mostConstant: string[];
};

/** `partial`: se manda antes de que acabe el año ("Enviar ahora"), así que dice "hasta ahora". */
export function wrappedEmail(d: WrappedData, siteUrl: string, partial = false): EmailParts {
  const suffix = partial ? " hasta ahora" : "";
  const rate = d.eligibleDays ? `${Math.round((d.responses / d.eligibleDays) * 100)}%` : "—";
  const stats = [
    { label: "Días que respondiste", value: `${d.responses} de ${d.eligibleDays} (${rate})` },
    { label: "Tu mejor racha", value: `${d.longestStreak} días` },
    { label: "Tu comida estrella", value: d.topFood ?? "—" },
    { label: "Hora típica", value: d.typicalTime ? `${d.typicalTime}` : "—" },
    { label: "Reacciones dadas / recibidas", value: `${d.reactionsGiven} / ${d.reactionsReceived}` },
    { label: "Comentarios", value: String(d.commentsGiven) },
    { label: "Fotos", value: String(d.photos) },
    { label: "Tu fan #1", value: d.fan ?? "—" },
  ];
  const extra = [
    d.favorite ? `A quien más le reaccionaste: <strong>${escapeHtml(d.favorite)}</strong>.` : "",
    d.bestMoment
      ? `Tu respuesta más celebrada fue la del ${escapeHtml(formatLocalDate(d.bestMoment.date))} (${d.bestMoment.score} reacciones y comentarios).`
      : "",
  ].filter(Boolean);
  return {
    subject: `🎁 Tu ${d.year}${suffix} en ${d.newsletterName}`,
    html: emailWindow({
      title: `🎁&nbsp; Tu ${d.year}${suffix}`,
      width: 520,
      body: `${p(`Hola ${escapeHtml(d.name)},`, 14)}
        ${big(partial ? `Así va tu ${d.year} en el newsletter de los importantes` : `Así fue tu ${d.year} en el newsletter de los importantes`)}
        ${statGrid(stats)}
        ${extra.map((e) => p(e, 14)).join("")}
        <p class="text-ink" style="margin:18px 0 8px;color:${l.ink};font-family:${FONT_DISPLAY};font-weight:700;font-size:15px;">Y el grupo…</p>
        ${p(`Entre todos mandaron <strong>${d.groupResponses}</strong> respuestas, con una participación de <strong>${d.groupRate}</strong>.`, 14)}
        ${d.mostConstant.length ? p(`🏆 Los más constantes del año: <strong>${d.mostConstant.map(escapeHtml).join(", ")}</strong>.`, 14) : ""}
        ${partial ? "" : p(`¡Por otro año contándonos qué hacemos al llegar a casa! 🥂`, 14)}
        ${button(siteUrl, "Ir al sitio →")}
        ${faint(partial ? "MSN status: 🟢 en línea" : "MSN status: 🎆 feliz año nuevo")}`,
    }),
    text: [
      `Hola ${d.name},`,
      "",
      `${partial ? "Así va" : "Así fue"} tu ${d.year} en el newsletter de los importantes:`,
      ...stats.map((s) => `- ${s.label}: ${s.value}`),
      ...extra.map((e) => e.replace(/<\/?strong>/g, "")),
      "",
      `El grupo mandó ${d.groupResponses} respuestas (participación ${d.groupRate}).`,
      ...(d.mostConstant.length ? [`Los más constantes: ${d.mostConstant.join(", ")}.`] : []),
      "",
      siteUrl,
    ].join("\n"),
  };
}

// ---------------------------------------------------------------------------
// 👋 Bienvenida

export function welcomeEmail({
  name,
  newsletterName,
  sendTime,
  siteUrl,
}: {
  name: string;
  newsletterName: string;
  sendTime: string;
  siteUrl: string;
}): EmailParts {
  const steps = [
    `<strong>Cada día</strong>, antes de las <strong>${escapeHtml(sendTime)}</strong>, entra al sitio y cuéntanos qué vas a hacer al llegar a casa (o a dónde vas si no llegas).`,
    `A las <strong>${escapeHtml(sendTime)}</strong> te llega el boletín con las respuestas de todo el grupo.`,
    "En el sitio puedes reaccionar y comentar las respuestas de los demás.",
    "Para entrar escribe tu correo: te llega un código de 6 dígitos (y un enlace). Escribe el código en la misma pantalla donde lo pediste.",
  ];
  return {
    subject: `👋 Te damos la bienvenida a ${newsletterName}`,
    html: emailWindow({
      title: "👋&nbsp; Bienvenida",
      body: `${p(`Hola ${escapeHtml(name)},`, 14)}
        ${big(`¡Ya eres parte de ${escapeHtml(newsletterName)}!`)}
        ${p("Así funciona:", 14)}
        ${steps.map((s, i) => p(`${i + 1}. ${s}`, 14)).join("")}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;"><tr>
          <td class="bg-panel2" style="${flatBg(l.panel2)}border-radius:10px;padding:10px 14px;">
            <p class="text-ink" style="margin:0;color:${l.ink};font-size:13px;line-height:1.55;">📱 <strong>Tip para iPhone:</strong> si abres el sitio desde un enlace de WhatsApp, toca el ícono de la brújula (abajo a la derecha) para abrirlo en Safari, o guarda el sitio en favoritos o en tu pantalla de inicio. Así no tendrás que iniciar sesión cada vez.</p>
          </td>
        </tr></table>
        ${button(siteUrl, "Entrar →")}
        ${faint("MSN status: 🟢 en línea")}`,
    }),
    text: [
      `Hola ${name},`,
      "",
      `¡Ya eres parte de ${newsletterName}! Así funciona:`,
      ...steps.map((s, i) => `${i + 1}. ${s.replace(/<\/?strong>/g, "")}`),
      "",
      "Tip para iPhone: si abres el sitio desde un enlace de WhatsApp, toca el ícono de la brújula para abrirlo en Safari, o guarda el sitio en favoritos. Así no tendrás que iniciar sesión cada vez.",
      "",
      siteUrl,
    ].join("\n"),
  };
}
