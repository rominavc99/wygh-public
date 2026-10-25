import { prisma } from "@/lib/prisma";
import { displayName } from "@/lib/display-name";
import { getSiteUrl } from "@/lib/site-url";
import { addDaysLocal, todayLocalDate } from "@/lib/date";
import { escapeHtml, emailPalette, FONT_DISPLAY, FONT_SERIF } from "@/lib/email-theme";
import { button, emailWindow } from "@/lib/engagement-email";
import { fromAddress, sendOne } from "@/lib/send-engagement";
import { recordNotification } from "@/lib/notifications";
import type { EmailParts } from "@/lib/extras-email";

// Correo dramático a quien no mandó su resumen: sale unos minutos después
// del boletín (Settings.missedEmailDelayMinutes), con uno de los textos de
// MISSED_VARIANTS y un poema triste del catálogo (Poem). Uno por persona y
// boletín aunque esté en varios grupos (MissedResponseEmail).

type Context = {
  /** "tu racha" o "tu racha de 12 días". */
  racha: string;
  /** Hora a la que salió el boletín ("12:00"). */
  hora: string;
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Los textos (asunto y párrafos). Cada persona recibe uno al azar, distinto del de la vez anterior. */
export const MISSED_VARIANTS: { subject: string; paragraphs: (c: Context) => string[] }[] = [
  {
    subject: "💔 Hoy no supimos de ti",
    paragraphs: ({ racha }) => [
      "Hoy no enviaste tu resumen. ¿Eres demasiado importante para este newsletter? ¿No te interesa? Tal vez tienes demasiadas ocupaciones.",
      `Entiendo, no es tu prioridad... Bueno, ahí va ${racha}, y con ella la esperanza, los sueños y las expectativas que teníamos de ti.`,
      "Espero que disfrutes leer lo que los demás sí escribieron. Ojalá mañana, en el nuevo día que se viene, exista un minuto que puedas dedicar a enviar tu resumen.",
    ],
  },
  {
    subject: "🥀 Salió el boletín... y tú no estabas",
    paragraphs: ({ racha, hora }) => [
      "El formulario te esperó todo el día. La casilla de «¿Qué hiciste hoy?» se quedó en blanco hasta el último segundo, mirando la puerta, como quien espera una carta que nunca llega.",
      `A las ${hora} salió el boletín sin ti. No pasa nada. (Sí pasa.) Se apagó ${racha}, y con ella la vela que habíamos dejado encendida en la ventana por si volvías.`,
      "Los demás sí contaron su día: léelos, si es que te queda tiempo entre tantos asuntos tan importantes. Te dejo este poema para que entiendas cómo nos sentimos.",
    ],
  },
  {
    subject: "📜 Comunicado oficial: tu ausencia ha sido registrada",
    paragraphs: ({ racha, hora }) => [
      `Por medio de la presente se informa que el boletín de hoy salió a las ${hora} sin tu resumen. Hubo silencio. Alguien preguntó por ti. Nadie supo qué responder.`,
      `Se procedió a velar ${racha} con todos los honores. Hubo flores, hubo llanto y una fotografía tuya sonriendo, de cuando sí respondías.`,
      "Mañana es otro día: uno en el que quizá encuentres un minuto para quienes todavía creemos en ti. Mientras tanto, el poeta lo dice mejor que nadie:",
    ],
  },
  {
    subject: "🕯️ Encendimos una vela por ti",
    paragraphs: ({ racha }) => [
      "Querido ser ocupadísimo: sabemos que el mundo no se detiene, que tienes pendientes, juntas y series por terminar. Lo entendemos. Lo que no entendemos es cómo vas a poder dormir en paz sabiendo que hoy no mandaste tu resumen.",
      `El boletín salió incompleto, como un rompecabezas al que le falta la pieza del centro: tú. Y ${racha}... bueno, eso ya es historia.`,
      "Lee lo que escribieron los demás y reflexiona. Mañana todavía puedes redimirte.",
    ],
  },
  {
    subject: "🌧️ El boletín salió más gris sin ti",
    paragraphs: ({ racha }) => [
      "No hay una forma bonita de decirlo: hoy no enviaste tu resumen.",
      `El boletín salió igual, porque la vida sigue, pero salió más gris. Las palabras que no escribiste se quedaron flotando en algún lugar entre tu teléfono y nuestros corazones rotos. ${cap(racha)} se fue sin despedirse.`,
      "Ojalá mañana vuelvas. Aquí seguiremos, mirando la bandeja de entrada como quien mira el mar esperando un barco que no llega. Mientras tanto, un poema que lo dice mejor que yo:",
    ],
  },
  {
    subject: "😔 ¿Fue algo que dijimos?",
    paragraphs: ({ racha }) => [
      "¿Fue algo que dijimos? ¿Algo que hicimos? Porque hoy, de todos los días, decidiste no mandar tu resumen.",
      `Repasamos el boletín una y otra vez buscando la razón. No la encontramos. Solo encontramos el hueco donde debía ir tu nombre, y ${racha} tirada en el piso, sin vida.`,
      "Si necesitas espacio, lo entendemos. Pero si solo se te olvidó... mañana hay otra oportunidad. Te dejamos un poema para que acompañe a tu conciencia.",
    ],
  },
];

type PoemRow = { id: string; title: string; author: string; text: string; fragment: boolean };

const l = emailPalette;

function p(text: string, size = 15): string {
  return `<p class="text-ink" style="margin:0 0 14px;color:${l.ink};font-size:${size}px;line-height:1.6;">${text}</p>`;
}

function poemHtml(poem: PoemRow): string {
  const stanzas = poem.text
    .split("\n\n")
    .map(
      (stanza) =>
        `<p class="text-ink" style="margin:0 0 12px;color:${l.ink};font-family:${FONT_SERIF};font-style:italic;font-size:15px;line-height:1.55;">${stanza
          .split("\n")
          .map(escapeHtml)
          .join("<br>")}</p>`
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="bg-panel2 border-edge" style="background-color:${l.panel2};border:1px solid ${l.edge};border-radius:10px;margin:6px 0 20px;">
    <tr><td style="padding:16px 18px;">
      <p class="text-pink" style="margin:0 0 10px;color:${l.pink};font-family:${FONT_DISPLAY};font-weight:700;font-size:16px;">${escapeHtml(poem.title)}</p>
      ${stanzas}
      <p class="text-faint" style="margin:6px 0 0;color:${l.faint};font-size:12.5px;">— ${escapeHtml(poem.author)}${poem.fragment ? " (fragmento)" : ""}</p>
    </td></tr>
  </table>`;
}

export function missedResponseEmail({
  name,
  variant,
  poem,
  racha,
  hora,
  boletinUrl,
}: {
  name: string;
  variant: number;
  poem: PoemRow;
  racha: string;
  hora: string;
  boletinUrl: string;
}): EmailParts {
  const v = MISSED_VARIANTS[variant % MISSED_VARIANTS.length];
  const paragraphs = v.paragraphs({ racha, hora });
  return {
    subject: v.subject,
    html: emailWindow({
      title: "💔&nbsp; Te extrañamos (más o menos)",
      width: 520,
      body: `
              ${p(`Hola ${escapeHtml(name)},`, 14)}
              ${paragraphs.map((t) => p(escapeHtml(t))).join("")}
              ${poemHtml(poem)}
              ${button(boletinUrl, "Leer lo que sí escribieron →")}
              <p class="text-faint" style="margin:22px 0 0;color:${l.faint};font-size:12px;line-height:1.5;">MSN status: 🔴 desconectado de nuestros corazones</p>`,
    }),
    text: [
      `Hola ${name},`,
      "",
      ...paragraphs.flatMap((t) => [t, ""]),
      poem.title,
      "",
      poem.text,
      "",
      `— ${poem.author}${poem.fragment ? " (fragmento)" : ""}`,
      "",
      `Leer lo que sí escribieron: ${boletinUrl}`,
    ].join("\n"),
  };
}

/** Racha que tenía antes de `date`: boletines seguidos (de sus grupos) en los que sí respondió. */
async function lostStreak(userId: string, date: string): Promise<number> {
  const [sends, responses] = await Promise.all([
    prisma.newsletterSend.findMany({
      where: { date: { lt: date }, group: { members: { some: { userId } } } },
      select: { date: true },
      distinct: ["date"],
      orderBy: { date: "desc" },
      take: 400,
    }),
    prisma.response.findMany({ where: { userId, date: { lt: date } }, select: { date: true }, orderBy: { date: "desc" }, take: 400 }),
  ]);
  const answered = new Set(responses.map((r) => r.date));
  let streak = 0;
  for (const s of sends) {
    if (!answered.has(s.date)) break;
    streak++;
  }
  return streak;
}

/** Un poema activo que no le haya tocado en sus últimos 40 correos (si se puede), y un texto distinto del anterior. */
async function pickFor(userId: string): Promise<{ poem: PoemRow | null; variant: number }> {
  const [poems, recent] = await Promise.all([
    prisma.poem.findMany({ where: { active: true }, select: { id: true, title: true, author: true, text: true, fragment: true } }),
    prisma.missedResponseEmail.findMany({ where: { userId }, orderBy: { sentAt: "desc" }, take: 40, select: { poemId: true, variant: true } }),
  ]);
  const used = new Set(recent.map((r) => r.poemId));
  const fresh = poems.filter((poem) => !used.has(poem.id));
  const pool = fresh.length ? fresh : poems;
  const poem = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
  const variants = MISSED_VARIANTS.map((_, i) => i).filter((i) => i !== recent[0]?.variant);
  return { poem, variant: variants[Math.floor(Math.random() * variants.length)] };
}

/** Quiénes no mandaron su resumen para el boletín de `date` de este grupo y todavía no tienen su correo. */
async function pendingFor(groupId: string, date: string) {
  return prisma.user.findMany({
    where: {
      active: true,
      groupMemberships: { some: { groupId } },
      responses: { none: { date } },
      missedEmails: { none: { date } },
    },
    orderBy: { name: "asc" },
  });
}

/** Manda el correo a `user` por el boletín de `date` del grupo. Devuelve si salió (false también si ya se le había mandado). */
async function sendTo(user: { id: string; name: string; username: string | null; email: string }, groupId: string, date: string, hora: string): Promise<boolean> {
  const { poem, variant } = await pickFor(user.id);
  if (!poem) return false;
  // Se aparta antes de mandar: si dos procesos coinciden, el segundo choca con el @@unique y no manda.
  let record: { id: string };
  try {
    record = await prisma.missedResponseEmail.create({ data: { userId: user.id, date, groupId, poemId: poem.id, variant } });
  } catch {
    return false;
  }
  const streak = await lostStreak(user.id, date);
  const settings = await prisma.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
  const boletinUrl = `${getSiteUrl()}/boletines?date=${date}&grupo=${groupId}`;
  const parts = missedResponseEmail({
    name: displayName(user),
    variant,
    poem,
    racha: streak >= 2 ? `tu racha de ${streak} días` : "tu racha",
    hora,
    boletinUrl,
  });
  const ok = await sendOne({ to: user.email, from: fromAddress(settings), ...parts });
  if (ok) await recordNotification({ userId: user.id, kind: "missed", title: parts.subject, text: parts.text, html: parts.html, url: boletinUrl });
  else await prisma.missedResponseEmail.update({ where: { id: record.id }, data: { sent: false } });
  return ok;
}

function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * Lo llama el worker cada minuto: por cada boletín enviado en las últimas
 * 12 horas cuyo envío fue hace al menos `missedEmailDelayMinutes`, manda el
 * correo a quien no mandó su resumen. Así también se pone al día si el
 * worker estuvo apagado justo a esa hora.
 */
export async function sendMissedResponseEmails(now = new Date()): Promise<{ sent: number; failed: number }> {
  const settings = await prisma.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
  if (!settings.missedEmailEnabled) return { sent: 0, failed: 0 };
  const today = todayLocalDate();
  const sends = await prisma.newsletterSend.findMany({
    where: {
      date: { in: [today, addDaysLocal(today, -1)] },
      status: { in: ["sent", "partial"] },
      sentAt: { gte: new Date(now.getTime() - 12 * 3600_000), lte: new Date(now.getTime() - settings.missedEmailDelayMinutes * 60_000) },
      group: { suspended: false },
    },
    orderBy: { sentAt: "asc" },
  });
  let sent = 0;
  let failed = 0;
  for (const send of sends) {
    for (const user of await pendingFor(send.groupId, send.date)) {
      if (await sendTo(user, send.groupId, send.date, hhmm(send.sentAt))) sent++;
      else failed++;
    }
  }
  return { sent, failed };
}

/**
 * Para "Enviar ahora" de Ajustes: quiénes no mandaron su resumen para el
 * último boletín enviado (de cada grupo) y todavía no tienen su correo.
 */
export async function missedManualJobs(): Promise<{ name: string; send: () => Promise<boolean> }[]> {
  const groups = await prisma.group.findMany({ where: { suspended: false }, select: { id: true } });
  const jobs: { name: string; send: () => Promise<boolean> }[] = [];
  const seen = new Set<string>();
  for (const group of groups) {
    const last = await prisma.newsletterSend.findFirst({ where: { groupId: group.id, status: { in: ["sent", "partial"] } }, orderBy: { date: "desc" } });
    if (!last || last.date < addDaysLocal(todayLocalDate(), -1)) continue;
    for (const user of await pendingFor(group.id, last.date)) {
      const key = `${user.id}:${last.date}`;
      if (seen.has(key)) continue;
      seen.add(key);
      jobs.push({ name: displayName(user), send: () => sendTo(user, group.id, last.date, hhmm(last.sentAt)) });
    }
  }
  return jobs;
}

/** Vista previa para el admin: un texto y un poema al azar. */
export async function missedResponsePreview(name: string): Promise<string> {
  const poems = await prisma.poem.findMany({ where: { active: true } });
  const poem = poems[Math.floor(Math.random() * poems.length)];
  if (!poem) return "<p>No hay poemas activos.</p>";
  return missedResponseEmail({
    name,
    variant: Math.floor(Math.random() * MISSED_VARIANTS.length),
    poem,
    racha: "tu racha de 12 días",
    hora: "12:00",
    boletinUrl: `${getSiteUrl()}/boletines`,
  }).html;
}
