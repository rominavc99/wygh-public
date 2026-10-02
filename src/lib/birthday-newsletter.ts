import { prisma } from "@/lib/prisma";
import { escapeHtml, emailPalette, flatBg, FONT_DISPLAY, FONT_SERIF } from "@/lib/email-theme";
import { formatLocalDate, oneYearBefore } from "@/lib/date";
import { displayName } from "@/lib/display-name";
import { pickStable } from "@/lib/pick";
import { getSiteUrl } from "@/lib/site-url";
import { toRecord, type HeroPhotoRecord } from "@/lib/hero-photos";
import {
  renderEmailShell,
  renderHero,
  responseDetailsHtml,
  responseDetailsText,
  capitalize,
  type NewsletterHero,
  type NewsletterResponse,
} from "@/lib/newsletter";

// Boletín de cumpleaños: sale por la mañana el día del cumpleaños de
// alguien (ver checkAndSendBirthdays en worker.ts), además del boletín
// diario de la tarde. Mismo marco que el diario, pero con portada propia
// (foto de las que subió quien cumple años, título/párrafo de Ajustes →
// Cumpleaños) y, en vez de las respuestas del día, sus 5 respuestas del
// último año con más reacciones + comentarios.

const TOP_MOMENTS = 5;

export type BirthdayMoment = Omit<NewsletterResponse, "userName"> & {
  responseId: string;
  date: string;
  reactions: { emoji: string; count: number }[];
  comments: { authorName: string; text: string }[];
};

export type BirthdayNewsletterContent = {
  html: string;
  text: string;
  hero: NewsletterHero;
  moments: BirthdayMoment[];
  greetingTemplate: string;
  celebrantName: string;
  topTitle: string;
};

/** Snapshot del top 5 guardado en BirthdayNewsletter.momentsJson. */
export type BirthdayMomentsSnapshot = { title: string; responseIds: string[] };

export function parseMomentsSnapshot(json: string): BirthdayMomentsSnapshot | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as BirthdayMomentsSnapshot;
  } catch {
    return null;
  }
}

/** Rellena {nombre} / {NOMBRE} (en mayúsculas) con el nombre de quien cumple años. */
export function fillBirthdayTemplate(template: string, name: string): string {
  return template.replaceAll("{NOMBRE}", name.toLocaleUpperCase("es")).replaceAll("{nombre}", name);
}

/** Fotos que subió esta persona (desde su respuesta diaria o con autor asignado en /admin/fotos). */
export async function photosByUser(userId: string): Promise<HeroPhotoRecord[]> {
  const photos = await prisma.heroPhoto.findMany({
    where: { authorId: userId },
    orderBy: { filename: "asc" },
    include: { author: true },
  });
  return photos.map(toRecord);
}

/**
 * Foto de portada del boletín de cumpleaños de `userId` en `date`. Igual
 * que resolveHeroPhotoForDate para el diario: si el admin eligió una a mano
 * o ya quedó fija una automática, se respeta; si no, se elige una de las
 * fotos de esa persona (estable para esa fecha) y se deja fija. null si la
 * persona nunca subió fotos — la portada sale sin imagen.
 */
export async function resolveBirthdayPhoto(userId: string, date: string): Promise<HeroPhotoRecord | null> {
  const [photos, edition] = await Promise.all([
    photosByUser(userId),
    prisma.birthdayNewsletter.findUnique({ where: { userId_date: { userId, date } } }),
  ]);
  if (photos.length === 0) return null;

  const current = edition?.heroPhotoId ? photos.find((p) => p.id === edition.heroPhotoId) : undefined;
  if (current) return current;

  const resolved = pickStable(photos, `${date}:${userId}`);
  await prisma.birthdayNewsletter.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, heroPhotoId: resolved.id },
    update: { heroPhotoId: resolved.id, heroPhotoManual: false },
  });
  return resolved;
}

/** Vuelve a sortear la foto (de verdad al azar, distinta a la actual si se puede) y la deja fija. */
export async function rerollBirthdayPhoto(userId: string, date: string): Promise<void> {
  const [photos, edition] = await Promise.all([
    photosByUser(userId),
    prisma.birthdayNewsletter.findUnique({ where: { userId_date: { userId, date } } }),
  ]);
  if (photos.length === 0) return;

  let pool = photos;
  if (edition?.heroPhotoId && photos.length > 1) pool = photos.filter((p) => p.id !== edition.heroPhotoId);
  const resolved = pool[Math.floor(Math.random() * pool.length)];

  await prisma.birthdayNewsletter.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, heroPhotoId: resolved.id },
    update: { heroPhotoId: resolved.id, heroPhotoManual: false },
  });
}

/** Fija a mano la foto. `heroPhotoId: null` vuelve a modo automático. */
export async function setManualBirthdayPhoto(userId: string, date: string, heroPhotoId: string | null): Promise<void> {
  await prisma.birthdayNewsletter.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, heroPhotoId, heroPhotoManual: Boolean(heroPhotoId) },
    update: { heroPhotoId, heroPhotoManual: Boolean(heroPhotoId) },
  });
}

/**
 * Las TOP_MOMENTS respuestas de `userId` del último año (desde el mismo día
 * del año anterior hasta el día antes de `date`) con más interacciones
 * (reacciones + comentarios). Solo cuentan las que tuvieron al menos una;
 * empates, la más reciente primero.
 */
export async function topMoments(userId: string, date: string): Promise<BirthdayMoment[]> {
  const responses = await prisma.response.findMany({
    where: { userId, date: { gte: oneYearBefore(date), lt: date } },
    include: {
      reactions: true,
      comments: { include: { user: true }, orderBy: { createdAt: "asc" } },
    },
  });

  return responses
    .map((r) => ({ r, score: r.reactions.length + r.comments.length }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || b.r.date.localeCompare(a.r.date))
    .slice(0, TOP_MOMENTS)
    .map(({ r }) => {
      const counts = new Map<string, number>();
      for (const reaction of r.reactions) counts.set(reaction.emoji, (counts.get(reaction.emoji) ?? 0) + 1);
      return {
        responseId: r.id,
        date: r.date,
        atHome: r.atHome,
        arrivingLate: r.arrivingLate,
        beforeHomePlan: r.beforeHomePlan,
        stayedHome: r.stayedHome,
        homePlan: r.homePlan,
        awayPlan: r.awayPlan,
        tonightPlan: r.tonightPlan,
        food: r.food,
        goingOut: r.goingOut,
        goingOutWhere: r.goingOutWhere,
        note: r.note,
        photoUrl: r.photoFilename ? `${getSiteUrl()}/${r.photoFilename}` : null,
        photoDescription: r.photoDescription,
        reactions: [...counts].map(([emoji, count]) => ({ emoji, count })).sort((a, b) => b.count - a.count),
        comments: r.comments.map((c) => ({ authorName: displayName(c.user), text: c.text })),
      };
    });
}

export async function buildBirthdayNewsletter(userId: string, date: string): Promise<BirthdayNewsletterContent> {
  const [user, settings, photo, moments] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} }),
    resolveBirthdayPhoto(userId, date),
    topMoments(userId, date),
  ]);

  const celebrantName = displayName(user);
  const hero: NewsletterHero = {
    enabled: true,
    title: fillBirthdayTemplate(settings.birthdayHeroTitle, celebrantName),
    paragraph: fillBirthdayTemplate(settings.birthdayHeroParagraph, celebrantName),
    imageUrl: photo ? `${getSiteUrl()}/${photo.filename}` : "",
    imageCaption: photo ? { date: photo.date, description: photo.description, authorName: photo.authorName } : null,
    linkUrl: "",
    linkText: "",
    dailyPhrase: null,
    dailyPhraseAuthor: null,
  };
  const topTitle = fillBirthdayTemplate(settings.birthdayTopTitle, celebrantName);

  return {
    html: renderBirthdayHtml({ date, hero, moments, topTitle, newsletterName: settings.newsletterName, tagline: settings.tagline }),
    text: renderBirthdayText({ date, hero, moments, topTitle, newsletterName: settings.newsletterName }),
    hero,
    moments,
    greetingTemplate: settings.birthdayGreetingTemplate,
    celebrantName,
    topTitle,
  };
}

function renderBirthdayHtml({
  date,
  hero,
  moments,
  topTitle,
  newsletterName,
  tagline,
}: {
  date: string;
  hero: NewsletterHero;
  moments: BirthdayMoment[];
  topTitle: string;
  newsletterName: string;
  tagline: string;
}): string {
  const l = emailPalette;
  const dateLabel = escapeHtml(capitalize(formatLocalDate(date)));

  const entries =
    moments.length > 0
      ? moments.map(renderMoment).join("\n")
      : `<tr><td class="text-faint" style="padding:8px 26px 20px;color:${l.faint};font-size:14px;">Este año todavía no hubo respuestas con reacciones o comentarios… ¡pero igual te queremos! 💖</td></tr>`;

  return renderEmailShell({
    title: escapeHtml(newsletterName),
    dateLabel,
    tagline: escapeHtml(tagline),
    body: `${renderHero(hero)}
          <tr>
            <td class="border-edge" style="padding:18px 26px 4px;border-top:1px solid ${l.edge};">
              <p class="text-faint" style="margin:0;color:${l.faint};font-size:11px;text-transform:uppercase;letter-spacing:.12em;font-weight:700;">🎂 Edición de cumpleaños · ${dateLabel}</p>
              <p class="text-ink" style="margin:8px 0 4px;color:${l.ink};font-size:15px;"><!--GREETING--></p>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 26px 4px;">
              <p class="text-ink" style="margin:0;color:${l.ink};font-family:${FONT_SERIF};font-weight:700;font-size:19px;line-height:1.25;">🏆 ${escapeHtml(topTitle)}</p>
            </td>
          </tr>
          ${entries}`,
  });
}

function renderMoment(moment: BirthdayMoment, index: number): string {
  const l = emailPalette;
  const dateLabel = escapeHtml(capitalize(formatLocalDate(moment.date)));

  const reactions = moment.reactions.length
    ? `<p style="margin:8px 0 0;">${moment.reactions
        .map(
          (r) =>
            `<span class="bg-panel border-edge text-ink" style="display:inline-block;margin:0 4px 4px 0;padding:2px 8px;${flatBg(l.panel)}border:1px solid ${l.edge};border-radius:10px;color:${l.ink};font-size:13px;">${escapeHtml(r.emoji)} ${r.count}</span>`
        )
        .join("")}</p>`
    : "";

  const comments = moment.comments.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="border-edge" style="margin-top:8px;border-top:1px dashed ${l.edge};">
        <tr><td style="padding:6px 0 0;">
          <p class="text-faint" style="margin:0 0 4px;color:${l.faint};font-size:10.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;">💬 Comentarios</p>
          ${moment.comments
            .map(
              (c) =>
                `<p class="text-soft" style="margin:0 0 4px;color:${l.soft};font-size:13px;"><strong class="text-pink" style="color:${l.pink};">${escapeHtml(c.authorName)}:</strong> ${escapeHtml(c.text)}</p>`
            )
            .join("\n          ")}
        </td></tr>
      </table>`
    : "";

  return `<tr>
    <td style="padding:8px 26px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td valign="top" class="bg-bubble border-edge" style="${flatBg(l.bubble)}border:1px solid ${l.edge};border-radius:14px;padding:11px 14px;">
            <p class="text-pink" style="margin:0 0 6px;color:${l.pink};font-family:${FONT_DISPLAY};font-weight:700;font-size:14px;">#${index + 1} · 📅 ${dateLabel}</p>
            ${responseDetailsHtml(moment)}
            ${reactions}
            ${comments}
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

function renderBirthdayText({
  date,
  hero,
  moments,
  topTitle,
  newsletterName,
}: {
  date: string;
  hero: NewsletterHero;
  moments: BirthdayMoment[];
  topTitle: string;
  newsletterName: string;
}): string {
  const lines = [`${newsletterName} — ${capitalize(formatLocalDate(date))}`, "{{GREETING}}", ""];

  lines.push("== PORTADA ==");
  if (hero.imageCaption?.description?.trim() || hero.imageCaption?.authorName?.trim()) {
    const parts = [
      hero.imageCaption.description?.trim() || null,
      hero.imageCaption.authorName?.trim() ? `Foto de ${hero.imageCaption.authorName.trim()}` : null,
    ].filter(Boolean);
    lines.push(`Foto: ${parts.join(" — ")}`);
  }
  lines.push(hero.title);
  if (hero.paragraph.trim()) lines.push(hero.paragraph);
  lines.push("");

  lines.push(`== ${topTitle.toLocaleUpperCase("es")} ==`);
  if (moments.length === 0) {
    lines.push("Este año todavía no hubo respuestas con reacciones o comentarios… ¡pero igual te queremos!");
  }
  moments.forEach((m, i) => {
    lines.push(`#${i + 1} · ${capitalize(formatLocalDate(m.date))}`);
    lines.push(...responseDetailsText(m));
    if (m.reactions.length) lines.push(`  Reacciones: ${m.reactions.map((r) => `${r.emoji} ${r.count}`).join("  ")}`);
    for (const c of m.comments) lines.push(`  💬 ${c.authorName}: ${c.text}`);
    lines.push("");
  });

  return lines.join("\n");
}

export type BirthdayNewsletterPreview = {
  sent: boolean;
  frozen: boolean;
  html: string;
  text: string;
  greetingTemplate: string;
  momentCount: number;
  recipientCount: number | null;
  sentAt: Date | null;
  status: string | null;
  error: string | null;
};

/** Para la vista previa del admin: lo congelado si ya se envió, si no se arma en vivo. */
export async function getBirthdayNewsletterPreview(userId: string, date: string): Promise<BirthdayNewsletterPreview> {
  const edition = await prisma.birthdayNewsletter.findUnique({ where: { userId_date: { userId, date } } });

  if (edition?.sentAt && edition.contentHtml) {
    return {
      sent: true,
      frozen: true,
      html: edition.contentHtml,
      text: edition.contentText,
      greetingTemplate: edition.greetingTemplate,
      momentCount: edition.momentCount,
      recipientCount: edition.recipientCount,
      sentAt: edition.sentAt,
      status: edition.status,
      error: edition.error,
    };
  }

  const content = await buildBirthdayNewsletter(userId, date);
  return {
    sent: false,
    frozen: false,
    html: content.html,
    text: content.text,
    greetingTemplate: content.greetingTemplate,
    momentCount: content.moments.length,
    recipientCount: null,
    sentAt: null,
    status: null,
    error: null,
  };
}
