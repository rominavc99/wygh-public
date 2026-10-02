import { prisma } from "@/lib/prisma";
import {
  escapeHtml,
  emailThemeHead,
  emailPalette,
  flatBg,
  winButtons,
  FONT_DISPLAY,
  FONT_BODY,
  FONT_SERIF,
} from "@/lib/email-theme";
import { formatLocalDate } from "@/lib/date";
import { avatarGradient } from "@/lib/avatar";
import { displayName } from "@/lib/display-name";
import { syncHeroPhotos, resolveHeroPhotoForDate, type HeroPhotoRecord } from "@/lib/hero-photos";
import { getSiteUrl } from "@/lib/site-url";
import { resolveDailyPhrase } from "@/lib/phrases";

export type NewsletterHero = {
  enabled: boolean;
  title: string;
  paragraph: string;
  imageUrl: string;
  imageCaption: { date: string | null; description: string | null; authorName: string | null } | null;
  linkUrl: string;
  linkText: string;
  dailyPhrase: string | null;
  dailyPhraseAuthor: string | null;
};

export type NewsletterResponse = {
  userName: string;
  atHome: boolean;
  arrivingLate: boolean;
  beforeHomePlan: string | null;
  stayedHome: boolean;
  homePlan: string | null;
  awayPlan: string | null;
  tonightPlan: string | null;
  food: string;
  goingOut: boolean;
  goingOutWhere: string | null;
  note: string | null;
  photoUrl: string | null;
  photoDescription: string | null;
};

export type NewsletterContent = {
  html: string;
  text: string;
  responses: NewsletterResponse[];
  greetingTemplate: string;
  hero: NewsletterHero;
};

/**
 * Resuelve la portada (hero) para `date`: título/párrafo de Ajustes, la
 * foto que le toca a ese día (ver resolveHeroPhotoForDate) y la frase del
 * día (ver resolveDailyPhrase). La usan tanto buildNewsletter() (para el
 * HTML del correo) como la vista nativa/interactiva de /boletines.
 */
export async function resolveNewsletterHero(
  date: string,
  settings: {
    heroEnabled: boolean;
    heroTitle: string;
    heroParagraph: string;
    heroImageUrl: string;
    heroLinkUrl: string;
    heroLinkText: string;
    selectedPhraseId: string;
  }
): Promise<NewsletterHero> {
  const photos = await syncHeroPhotos();
  let heroImageUrl = settings.heroImageUrl.trim();
  let matchedPhoto: HeroPhotoRecord | null = null;
  if (!heroImageUrl) {
    matchedPhoto = await resolveHeroPhotoForDate(date, photos);
    if (matchedPhoto) heroImageUrl = `${getSiteUrl()}/${matchedPhoto.filename}`;
  } else {
    // La URL puesta a mano en Ajustes igual puede apuntar a una foto del
    // catálogo — si es así, se usa su metadata (fecha/descripción) como
    // pie de foto.
    matchedPhoto = photos.find((p) => heroImageUrl.endsWith(p.filename)) ?? null;
  }
  const imageCaption = matchedPhoto
    ? { date: matchedPhoto.date, description: matchedPhoto.description, authorName: matchedPhoto.authorName }
    : null;

  const dailyPhrase = await resolveDailyPhrase(date, settings.selectedPhraseId);

  return {
    enabled: settings.heroEnabled,
    title: settings.heroTitle,
    paragraph: settings.heroParagraph,
    imageUrl: heroImageUrl,
    imageCaption,
    linkUrl: settings.heroLinkUrl,
    linkText: settings.heroLinkText,
    dailyPhrase: dailyPhrase?.text ?? null,
    dailyPhraseAuthor: dailyPhrase?.authorName ?? null,
  };
}

export async function buildNewsletter(date: string): Promise<NewsletterContent> {
  const [responses, settings] = await Promise.all([
    prisma.response.findMany({
      where: { date },
      include: { user: true },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} }),
  ]);

  const items: NewsletterResponse[] = responses.map((r) => ({
    userName: displayName(r.user),
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
  }));

  const hero = await resolveNewsletterHero(date, settings);

  return {
    html: renderHtml({
      date,
      items,
      newsletterName: settings.newsletterName,
      tagline: settings.tagline,
      hero,
    }),
    text: renderText({ date, items, newsletterName: settings.newsletterName, hero }),
    responses: items,
    greetingTemplate: settings.greetingTemplate,
    hero,
  };
}

function renderHtml({
  date,
  items,
  newsletterName,
  tagline,
  hero,
}: {
  date: string;
  items: NewsletterResponse[];
  newsletterName: string;
  tagline: string;
  hero: NewsletterHero;
}): string {
  const dateLabel = escapeHtml(capitalize(formatLocalDate(date)));
  const title = escapeHtml(newsletterName);
  const safeTagline = escapeHtml(tagline);
  const l = emailPalette;

  const entries =
    items.length > 0
      ? items.map(renderCard).join("\n")
      : `<tr><td class="text-faint" style="padding:8px 26px 20px;color:${l.faint};font-size:14px;">Nadie respondió hoy. Todos son unos sandwiches remojados.</td></tr>`;

  const heroBlock = hero.enabled && hero.title.trim() ? renderHero(hero) : "";

  return renderEmailShell({
    title,
    dateLabel,
    tagline: safeTagline,
    body: `${heroBlock}
          <tr>
            <td class="border-edge" style="padding:18px 26px 4px;${heroBlock ? `border-top:1px solid ${l.edge};` : ""}">
              <p class="text-faint" style="margin:0;color:${l.faint};font-size:11px;text-transform:uppercase;letter-spacing:.12em;font-weight:700;">📻 Reportes de la noche · ${dateLabel} · ${items.length} respuesta${items.length === 1 ? "" : "s"}</p>
              <p class="text-ink" style="margin:8px 0 4px;color:${l.ink};font-size:15px;"><!--GREETING--></p>
            </td>
          </tr>
          ${entries}`,
  });
}

/**
 * Marco común del correo (barra de título, lema, pie). `title`, `dateLabel`
 * y `tagline` ya vienen escapados; `body` son las filas <tr> de en medio.
 * Lo usan el boletín diario y el de cumpleaños (src/lib/birthday-newsletter.ts).
 */
export function renderEmailShell({
  title,
  dateLabel,
  tagline,
  body,
}: {
  title: string;
  dateLabel: string;
  tagline: string;
  body: string;
}): string {
  const l = emailPalette;
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — ${dateLabel}</title>
${emailThemeHead()}
</head>
<body class="bg-page" style="margin:0;padding:0;${flatBg(l.pageFrom)}font-family:${FONT_BODY};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="bg-page" style="${flatBg(l.pageFrom)}padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" class="bg-panel border-panel" style="max-width:600px;width:100%;${flatBg(l.panel)}border-radius:14px;overflow:hidden;border:2px solid ${l.panelBorder};">
          <tr>
            <td class="bg-titlebar" style="${flatBg(l.titlebar)}padding:14px 18px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
                <td class="text-white" style="font-family:${FONT_DISPLAY};font-weight:700;font-size:17px;color:${l.white};">💌&nbsp; ${title}</td>
                <td align="right">${winButtons()}</td>
              </tr></table>
            </td>
          </tr>
          <tr>
            <td class="bg-panel2 border-edge" style="${flatBg(l.panel2)}border-bottom:1px solid ${l.edge};padding:10px 18px;">
              <p class="text-soft" style="margin:0;color:${l.soft};font-size:12px;font-weight:700;">${tagline}</p>
            </td>
          </tr>
          ${body}
          <tr>
            <td class="border-edge" style="padding:18px 26px 24px;border-top:1px solid ${l.edge};">
              <p class="text-faint" style="margin:0;color:${l.faint};font-size:11.5px;">${title} — actualizaciones de importancia para los importantes. · MSN status: 🟢 en línea</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function renderHero(hero: NewsletterHero): string {
  const l = emailPalette;
  const safeTitle = escapeHtml(hero.title);
  const safeParagraph = hero.paragraph.trim() ? escapeHtml(hero.paragraph) : "";
  const safeImageUrl = hero.imageUrl.trim() ? escapeHtml(hero.imageUrl.trim()) : "";
  const safeLinkUrl = hero.linkUrl.trim() ? escapeHtml(hero.linkUrl.trim()) : "";
  const safeLinkText = escapeHtml(hero.linkText.trim() || "Leer más");
  const safePhrase = hero.dailyPhrase?.trim() ? escapeHtml(hero.dailyPhrase.trim()) : "";
  const safePhraseAuthor = hero.dailyPhraseAuthor?.trim() ? escapeHtml(hero.dailyPhraseAuthor.trim()) : "";

  const captionParts: string[] = [];
  if (hero.imageCaption?.date) {
    captionParts.push(escapeHtml(capitalize(formatLocalDate(hero.imageCaption.date))));
  }
  if (hero.imageCaption?.description?.trim()) {
    captionParts.push(escapeHtml(hero.imageCaption.description.trim()));
  }
  if (hero.imageCaption?.authorName?.trim()) {
    captionParts.push(`Foto de ${escapeHtml(hero.imageCaption.authorName.trim())}`);
  }
  const safeCaption = captionParts.join(" — ");

  const image = safeImageUrl
    ? `<tr><td style="padding:0 0 ${safeCaption ? "4px" : "14px"};">
        <img src="${safeImageUrl}" alt="" width="548" style="display:block;width:100%;max-width:548px;height:auto;border:2px solid ${l.panelBorder};image-rendering:pixelated;image-rendering:crisp-edges;" />
      </td></tr>`
    : "";
  const caption = safeCaption
    ? `<tr><td class="text-faint" style="padding:0 0 14px;color:${l.faint};font-size:11.5px;font-style:italic;">📷 ${safeCaption}</td></tr>`
    : "";
  const paragraph = safeParagraph
    ? `<tr><td class="text-soft" style="padding:0 0 ${safePhrase || safeLinkUrl ? "10px" : "0"};color:${l.soft};font-size:14.5px;line-height:1.6;">${safeParagraph}</td></tr>`
    : "";
  const phrase = safePhrase
    ? `<tr><td style="padding:0 0 ${safeLinkUrl ? "10px" : "0"};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="bg-panel2 border-edge" style="${flatBg(l.panel2)}border:1px solid ${l.edge};border-radius:8px;">
          <tr><td style="padding:10px 14px;text-align:center;">
            <p class="text-faint" style="margin:0;color:${l.faint};font-size:10.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;">💭 Frase del día</p>
            <p class="text-ink" style="margin:4px 0 0;color:${l.ink};font-family:${FONT_SERIF};font-style:italic;font-size:14.5px;">"${safePhrase}"</p>
            ${safePhraseAuthor ? `<p class="text-faint" style="margin:4px 0 0;color:${l.faint};font-size:11px;">— ${safePhraseAuthor}</p>` : ""}
          </td></tr>
        </table>
      </td></tr>`
    : "";
  const link = safeLinkUrl
    ? `<tr><td><a href="${safeLinkUrl}" class="text-pink" style="font-family:${FONT_DISPLAY};font-weight:700;font-size:13px;color:${l.pink};text-decoration:none;">${safeLinkText} →</a></td></tr>`
    : "";

  return `<tr>
    <td style="padding:16px 26px 6px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="border-edge" style="border-top:3px double ${l.edge};border-bottom:1px solid ${l.edge};">
        <tr><td style="padding:14px 0 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${image}
            ${caption}
            <tr><td class="text-ink" style="padding:0 0 8px;color:${l.ink};font-family:${FONT_SERIF};font-weight:700;font-size:24px;line-height:1.18;">${safeTitle}</td></tr>
            ${paragraph}
            ${phrase}
            ${link}
          </table>
        </td></tr>
      </table>
    </td>
  </tr>`;
}

function renderCard(item: NewsletterResponse): string {
  const l = emailPalette;
  const name = escapeHtml(item.userName);
  const initial = escapeHtml(item.userName.charAt(0).toUpperCase());
  const gradient = avatarGradient(item.userName);

  return `<tr>
    <td style="padding:8px 26px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td width="44" valign="top" style="padding-right:10px;">
            <table role="presentation" width="36" height="36" cellpadding="0" cellspacing="0" style="width:36px;height:36px;border-radius:50%;background-color:#ff5fa8;background-image:${gradient};border:2px solid #ffffff;">
              <tr><td align="center" valign="middle" style="font-family:${FONT_DISPLAY};font-weight:700;font-size:15px;color:#ffffff;">${initial}</td></tr>
            </table>
          </td>
          <td valign="top" class="bg-bubble border-edge" style="${flatBg(l.bubble)}border:1px solid ${l.edge};border-radius:4px 14px 14px 14px;padding:11px 14px;">
            <p class="text-pink" style="margin:0 0 4px;color:${l.pink};font-family:${FONT_DISPLAY};font-weight:700;font-size:14.5px;">${name}</p>
            ${responseDetailsHtml(item)}
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

/** Contenido de una respuesta (plan, comida, nota, foto) dentro de su burbuja, sin el nombre. */
export function responseDetailsHtml(item: Omit<NewsletterResponse, "userName">): string {
  const l = emailPalette;
  const isOnTime = item.atHome && !item.stayedHome && !item.arrivingLate;
  const plan = escapeHtml(item.atHome ? item.homePlan ?? "" : item.awayPlan ?? "");
  const planLabel = item.atHome ? (item.stayedHome ? "Hoy en casa" : "Al llegar a casa") : "Para dónde va";
  const beforePlan = item.arrivingLate && item.beforeHomePlan ? escapeHtml(item.beforeHomePlan) : null;
  const food = escapeHtml(item.food);
  const goingOut = item.goingOut ? `Sí, a ${escapeHtml(item.goingOutWhere ?? "")}` : "No";
  const note = item.note ? escapeHtml(item.note) : null;
  const tonightPlan = item.stayedHome && item.tonightPlan ? escapeHtml(item.tonightPlan) : null;
  const safePhotoUrl = item.photoUrl ? escapeHtml(item.photoUrl) : null;
  const safePhotoDescription = item.photoDescription ? escapeHtml(item.photoDescription) : "";

  const photoBlock = safePhotoUrl
    ? `<img src="${safePhotoUrl}" alt="" width="200" style="display:block;width:100%;max-width:200px;height:auto;border:2px solid ${l.panelBorder};border-radius:6px;margin:8px 0 4px;" />
       ${safePhotoDescription ? `<p class="text-faint" style="margin:0 0 4px;color:${l.faint};font-size:11.5px;font-style:italic;">📷 ${safePhotoDescription}</p>` : ""}`
    : "";

  return `${beforePlan ? `<p class="text-soft" style="margin:0 0 3px;color:${l.soft};font-size:13.5px;"><strong class="text-ink" style="color:${l.ink};">Antes de llegar:</strong> ${beforePlan}</p>` : ""}
            <p class="text-soft" style="margin:0 0 3px;color:${l.soft};font-size:13.5px;"><strong class="text-ink" style="color:${l.ink};">${planLabel}:</strong> ${plan}</p>
            ${tonightPlan ? `<p class="text-soft" style="margin:0 0 3px;color:${l.soft};font-size:13.5px;"><strong class="text-ink" style="color:${l.ink};">Esta noche:</strong> ${tonightPlan}</p>` : ""}
            <p class="text-soft" style="margin:0 0 3px;color:${l.soft};font-size:13.5px;"><strong class="text-ink" style="color:${l.ink};">Come:</strong> ${food}</p>
            ${isOnTime ? `<p class="text-soft" style="margin:0;color:${l.soft};font-size:13.5px;"><strong class="text-ink" style="color:${l.ink};">Sale:</strong> ${goingOut}</p>` : ""}
            ${note ? `<p class="text-ink border-pink" style="margin:8px 0 0;padding:4px 0 0 10px;border-left:3px solid ${l.pink};color:${l.ink};font-size:13.5px;font-style:italic;">"${note}"</p>` : ""}
            ${photoBlock}`;
}

function renderText({
  date,
  items,
  newsletterName,
  hero,
}: {
  date: string;
  items: NewsletterResponse[];
  newsletterName: string;
  hero: NewsletterHero;
}): string {
  const dateLabel = capitalize(formatLocalDate(date));
  const lines = [`${newsletterName} — ${dateLabel}`, "{{GREETING}}", ""];

  if (hero.enabled && hero.title.trim()) {
    lines.push("== PORTADA ==");
    if (hero.imageCaption?.date || hero.imageCaption?.description || hero.imageCaption?.authorName) {
      const captionParts = [
        hero.imageCaption.date ? capitalize(formatLocalDate(hero.imageCaption.date)) : null,
        hero.imageCaption.description?.trim() || null,
        hero.imageCaption.authorName?.trim() ? `Foto de ${hero.imageCaption.authorName.trim()}` : null,
      ].filter(Boolean);
      lines.push(`Foto: ${captionParts.join(" — ")}`);
    }
    lines.push(hero.title);
    if (hero.paragraph.trim()) lines.push(hero.paragraph);
    if (hero.dailyPhrase?.trim()) {
      lines.push(
        `Frase del día: "${hero.dailyPhrase.trim()}"${hero.dailyPhraseAuthor?.trim() ? ` — ${hero.dailyPhraseAuthor.trim()}` : ""}`
      );
    }
    if (hero.linkUrl.trim()) lines.push(`${hero.linkText || "Leer más"}: ${hero.linkUrl}`);
    lines.push("");
  }

  lines.push("== REPORTES DE LA NOCHE ==");

  if (items.length === 0) {
    lines.push("Nadie respondió hoy. Todos son unos sandwiches remojados.");
  } else {
    for (const item of items) {
      lines.push(`${item.userName}`);
      lines.push(...responseDetailsText(item));
      lines.push("");
    }
  }

  return lines.join("\n");
}

/** Versión texto plano de responseDetailsHtml(), una línea indentada por dato. */
export function responseDetailsText(item: Omit<NewsletterResponse, "userName">): string[] {
  const lines: string[] = [];
  const isOnTime = item.atHome && !item.stayedHome && !item.arrivingLate;
  const planLabel = item.atHome ? (item.stayedHome ? "Hoy en casa" : "Al llegar a casa") : "Para dónde va";
  const plan = item.atHome ? item.homePlan ?? "" : item.awayPlan ?? "";
  if (item.arrivingLate && item.beforeHomePlan) lines.push(`  Antes de llegar: ${item.beforeHomePlan}`);
  lines.push(`  ${planLabel}: ${plan}`);
  if (item.stayedHome && item.tonightPlan) lines.push(`  Esta noche: ${item.tonightPlan}`);
  lines.push(`  Come: ${item.food}`);
  if (isOnTime) lines.push(`  Sale: ${item.goingOut ? `Sí, a ${item.goingOutWhere ?? ""}` : "No"}`);
  if (item.note) lines.push(`  Nota: ${item.note}`);
  // El link directo ahora requiere sesión iniciada (ver
  // src/app/IMG/respuestas/[filename]/route.ts) — en la versión con
  // imágenes va incrustada como adjunto, pero en texto plano no hay
  // forma de embeber una imagen, así que aquí solo se avisa que hay
  // una, sin un link que de todos modos no serviría sin sesión.
  if (item.photoUrl) lines.push(`  Foto: adjunta${item.photoDescription ? ` (${item.photoDescription})` : ""}`);
  return lines;
}

export type NewsletterForDate = {
  /** true si ya existe un NewsletterSend para esa fecha (con o sin snapshot). */
  sent: boolean;
  /** true si el contenido viene del snapshot guardado (congelado), no reconstruido en vivo. */
  frozen: boolean;
  html: string;
  text: string;
  greetingTemplate: string;
  responseCount: number;
  recipientCount: number | null;
  sentAt: Date | null;
};

/**
 * Contenido del boletín de una fecha, preferiendo el snapshot guardado en
 * el envío real (congelado tal cual se mandó) sobre reconstruirlo en vivo
 * con el Settings actual — que puede haber cambiado desde entonces. Cae a
 * reconstruir en vivo si el día no se ha enviado todavía, o si el envío es
 * de antes de que existiera este snapshot (contentHtml vacío).
 */
export async function getNewsletterForDate(date: string): Promise<NewsletterForDate> {
  const send = await prisma.newsletterSend.findUnique({ where: { date } });

  if (send?.contentHtml) {
    return {
      sent: true,
      frozen: true,
      html: send.contentHtml,
      text: send.contentText,
      greetingTemplate: send.greetingTemplate,
      responseCount: send.responseCount,
      recipientCount: send.recipientCount,
      sentAt: send.sentAt,
    };
  }

  const content = await buildNewsletter(date);
  return {
    sent: Boolean(send),
    frozen: false,
    html: content.html,
    text: content.text,
    greetingTemplate: content.greetingTemplate,
    responseCount: content.responses.length,
    recipientCount: send?.recipientCount ?? null,
    sentAt: send?.sentAt ?? null,
  };
}

/**
 * Portada de un boletín ya enviado, tal cual salió ese día — nunca la de
 * los Ajustes actuales (que pueden estar preparados ya para otro día).
 * Prefiere el snapshot heroJson; para envíos previos a ese campo la saca
 * del contenido congelado (contentText/contentHtml). Devuelve null si el
 * envío tampoco tiene contenido congelado (muy viejo) — ahí no hay de dónde
 * sacarla y el llamador decide.
 */
export function getSentHero(send: { heroJson: string; contentHtml: string; contentText: string }): NewsletterHero | null {
  if (send.heroJson) {
    try {
      return JSON.parse(send.heroJson) as NewsletterHero;
    } catch {
      // Cae a reconstruirla del contenido congelado.
    }
  }
  if (!send.contentText) return null;
  return heroFromSnapshot(send.contentHtml, send.contentText);
}

/**
 * Reconstruye la portada a partir del texto/HTML congelados de un envío
 * (ver renderText/renderHero): el texto plano tiene título, párrafo, pie de
 * foto y frase sin escapar; la URL de la foto y el link solo están en el
 * HTML. El pie de foto se reconstruye sin su fecha (la vista de /boletines
 * no la muestra).
 */
function heroFromSnapshot(contentHtml: string, contentText: string): NewsletterHero {
  const hero: NewsletterHero = {
    enabled: false,
    title: "",
    paragraph: "",
    imageUrl: "",
    imageCaption: null,
    linkUrl: "",
    linkText: "Leer más",
    dailyPhrase: null,
    dailyPhraseAuthor: null,
  };

  const lines = contentText.split("\n");
  const start = lines.indexOf("== PORTADA ==");
  const end = lines.indexOf("== REPORTES DE LA NOCHE ==");
  if (start === -1 || end === -1) return hero;

  const block = lines.slice(start + 1, end);
  while (block.length && !block[block.length - 1].trim()) block.pop();

  if (block[0]?.startsWith("Foto: ")) {
    const parts = block.shift()!.slice("Foto: ".length).split(" — ");
    const authorPart = parts.find((p) => p.startsWith("Foto de "));
    const rest = parts.filter((p) => p !== authorPart && !/^\p{L}+, \d{1,2} de \p{L}+ de \d{4}$/u.test(p));
    hero.imageCaption = {
      date: null,
      description: rest.join(" — ") || null,
      authorName: authorPart ? authorPart.slice("Foto de ".length) : null,
    };
  }

  hero.enabled = true;
  hero.title = block.shift() ?? "";

  const link = contentHtml.match(/<a href="([^"]*)" class="text-pink"[^>]*>([^<]*) →<\/a>/);
  if (link) {
    hero.linkUrl = unescapeHtml(link[1]);
    hero.linkText = unescapeHtml(link[2]);
    block.pop();
  }

  const phrase = block[block.length - 1]?.match(/^Frase del día: "(.*)"(?: — (.+))?$/);
  if (phrase) {
    hero.dailyPhrase = phrase[1];
    hero.dailyPhraseAuthor = phrase[2] ?? null;
    block.pop();
  }

  hero.paragraph = block.join("\n");

  const image = contentHtml.match(/<img src="([^"]*)" alt="" width="548"/);
  if (image) hero.imageUrl = unescapeHtml(image[1]);

  return hero;
}

function unescapeHtml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * Reemplaza el marcador de saludo por la plantilla configurada en Ajustes,
 * sustituyendo {nombre} por el nombre real del destinatario.
 */
export function personalizeGreeting(
  content: { html: string; text: string },
  recipientName: string,
  greetingTemplate: string
) {
  const greeting = greetingTemplate.replaceAll("{nombre}", recipientName);
  const safeGreeting = escapeHtml(greeting);

  return {
    html: content.html.replace("<!--GREETING-->", safeGreeting),
    text: content.text.replace("{{GREETING}}", greeting),
  };
}

export function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
