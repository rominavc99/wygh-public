import { escapeHtml, emailPalette, flatBg, FONT_DISPLAY } from "@/lib/email-theme";
import { button, emailWindow } from "@/lib/engagement-email";
import { shortDate, type PersonDays, type TopList, type WeeklyReport } from "@/lib/weekly-report";
import type { UserStats } from "@/lib/participation-stats";

type Args = { name: string; userId: string; report: WeeklyReport; siteUrl: string; isAdmin: boolean };

const l = emailPalette;

function pct(responses: number, eligible: number): string {
  return eligible ? `${Math.round((responses / eligible) * 100)}%` : "—";
}

function personalLine(me: UserStats | undefined): string {
  if (!me || me.eligibleDays === 0) return "";
  if (me.responses === me.eligibleDays) return `Tú respondiste todos los días (${me.responses} de ${me.eligibleDays}). Eres de los importantes 💖`;
  if (me.responses === 0) return `Tú no respondiste ningún día esta semana (0 de ${me.eligibleDays}). Te extrañamos 🥲`;
  return `Tú respondiste ${me.responses} de ${me.eligibleDays} días.`;
}

function heading(text: string): string {
  return `<p class="text-ink" style="margin:22px 0 8px;color:${l.ink};font-family:${FONT_DISPLAY};font-weight:700;font-size:15px;">${text}</p>`;
}

function paragraph(text: string, size = 14): string {
  return `<p class="text-ink" style="margin:0 0 12px;color:${l.ink};font-size:${size}px;line-height:1.6;">${text}</p>`;
}

function topListHtml(list: TopList): string {
  const items = list.entries.length
    ? list.entries
        .map(
          (e, i) =>
            `<p class="text-ink" style="margin:0 0 3px;color:${l.ink};font-size:13px;line-height:1.45;">${i + 1}. <strong>${escapeHtml(e.name)}</strong> <span class="text-soft" style="color:${l.soft};">· ${escapeHtml(e.label)}</span></p>`
        )
        .join("")
    : `<p class="text-soft" style="margin:0;color:${l.soft};font-size:13px;">${escapeHtml(list.empty)}</p>`;
  const tied = list.tiedMore
    ? `<p class="text-faint" style="margin:2px 0 0;color:${l.faint};font-size:11.5px;">y ${list.tiedMore} más con lo mismo</p>`
    : "";
  return `<p class="text-ink" style="margin:0 0 6px;color:${l.ink};font-family:${FONT_DISPLAY};font-weight:700;font-size:13.5px;">${list.icon} ${escapeHtml(list.title)}</p>${items}${tied}`;
}

/** Las tres parejas "más / menos", cada una en una fila de dos columnas. */
function topsHtml(tops: WeeklyReport["tops"]): string {
  return tops
    .map(
      ([best, worst]) => `<tr>
        <td width="50%" valign="top" class="bg-bubble" style="${flatBg(l.bubble)}border-radius:10px;padding:10px 12px;">${topListHtml(best)}</td>
        <td width="8" style="font-size:0;">&nbsp;</td>
        <td width="50%" valign="top" class="bg-panel2" style="${flatBg(l.panel2)}border-radius:10px;padding:10px 12px;">${topListHtml(worst)}</td>
      </tr>
      <tr><td colspan="3" height="8" style="font-size:0;line-height:0;">&nbsp;</td></tr>`
    )
    .join("");
}

function peopleList(people: PersonDays[], empty: string): string {
  if (people.length === 0) return paragraph(empty, 13);
  return people
    .map(
      (p) =>
        `<p class="text-ink" style="margin:0 0 4px;color:${l.ink};font-size:13px;line-height:1.5;">• <strong>${escapeHtml(p.name)}</strong>: ${p.days} días <span class="text-soft" style="color:${l.soft};">(${escapeHtml(p.detail)})</span></p>`
    )
    .join("");
}

function rankingBars(ranking: UserStats[], userId: string): string {
  return ranking
    .map((u) => {
      const ratio = u.eligibleDays ? u.responses / u.eligibleDays : 0;
      // Barra con dos celdas (lleno + resto) — lo único que se ve igual en
      // Gmail, Outlook y Apple Mail.
      const filled = Math.max(1, Math.round(ratio * 100));
      const bar =
        ratio > 0
          ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
              <td width="${filled}%" height="12" class="bg-titlebar" style="${flatBg(l.titlebar)}border-radius:0 4px 4px 0;font-size:0;line-height:0;">&nbsp;</td>
              ${filled < 100 ? `<td height="12" style="font-size:0;line-height:0;">&nbsp;</td>` : ""}
            </tr></table>`
          : "";
      return `<tr>
              <td style="padding:5px 8px 5px 0;font-size:13px;color:${l.ink};${u.id === userId ? "font-weight:700;" : ""}white-space:nowrap;" class="text-ink">${escapeHtml(u.name)}</td>
              <td width="55%" class="bg-panel2" style="padding:0;${flatBg(l.panel2)}">${bar}</td>
              <td align="right" style="padding:5px 0 5px 8px;font-size:12px;color:${l.soft};white-space:nowrap;" class="text-soft">${u.responses}/${u.eligibleDays}</td>
            </tr>`;
    })
    .join("");
}

function table(headers: string[], rows: (string | number)[][]): string {
  const th = headers
    .map((h, i) => `<td align="${i === 0 ? "left" : "right"}" class="text-soft" style="padding:4px 4px;color:${l.soft};font-size:11px;font-weight:700;">${h}</td>`)
    .join("");
  const body = rows
    .map(
      (r) =>
        `<tr>${r
          .map(
            (c, i) =>
              `<td align="${i === 0 ? "left" : "right"}" class="text-ink" style="padding:4px 4px;border-top:1px solid ${l.edge};color:${l.ink};font-size:12px;${i === 0 ? "font-weight:700;" : ""}">${escapeHtml(String(c))}</td>`
          )
          .join("")}</tr>`
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 4px;"><tr>${th}</tr>${body}</table>`;
}

function adminSection(report: WeeklyReport): string {
  const a = report.admin;
  const now = report.groupEligible ? report.groupResponses / report.groupEligible : null;
  const before = a.previousEligible ? a.previousResponses / a.previousEligible : null;
  const delta =
    now !== null && before !== null
      ? (() => {
          const points = Math.round((now - before) * 100);
          return points === 0 ? "igual que la semana anterior" : `${points > 0 ? "▲" : "▼"} ${Math.abs(points)} puntos contra la semana anterior (${pct(a.previousResponses, a.previousEligible)})`;
        })()
      : "sin datos de la semana anterior";

  const lines: string[] = [];
  lines.push(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="border-pink" style="margin:26px 0 0;border-top:3px solid ${l.pink};"><tr><td style="padding-top:6px;">
    <p class="text-pink" style="margin:0 0 4px;color:${l.pink};font-family:${FONT_DISPLAY};font-weight:700;font-size:16px;">🛠️ Solo para admins</p>
    <p class="text-soft" style="margin:0;color:${l.soft};font-size:12px;">Esta parte no la ven los demás.</p>
  </td></tr></table>`);

  lines.push(heading("Tendencia"));
  lines.push(paragraph(`Participación ${pct(report.groupResponses, report.groupEligible)}: ${escapeHtml(delta)}.`, 13));

  lines.push(heading("Día por día"));
  lines.push(table(["Día", "Respondieron", "%"], a.daily.map((d) => [shortDate(d.date), `${d.responded} de ${d.eligible}`, pct(d.responded, d.eligible)])));

  lines.push(heading("Detalle por persona"));
  lines.push(
    table(
      ["Persona", "Resp.", "❤️ d/r", "💬 d/r", "Sin resp.", "Visita"],
      report.ranking.map((u) => [
        u.name,
        `${u.responses}/${u.eligibleDays}`,
        `${u.reactionsGiven}/${u.reactionsReceived}`,
        `${u.commentsGiven}/${u.commentsReceived}`,
        u.missedStreak,
        u.lastVisitDate ? shortDate(u.lastVisitDate) : "—",
      ])
    )
  );
  lines.push(`<p class="text-faint" style="margin:0;color:${l.faint};font-size:11px;">d/r = dadas / recibidas. "Sin resp." = días seguidos sin responder hasta hoy.</p>`);

  lines.push(heading("🥪 Correos de inactividad enviados"));
  lines.push(
    a.nudges.length
      ? paragraph(a.nudges.map((n) => `${escapeHtml(n.name)} (${n.missedDays} días)`).join(", "), 13)
      : paragraph("Ninguno esta semana.", 13)
  );

  lines.push(heading("🚪 Para pensar en desactivar"));
  lines.push(peopleList(a.deactivateCandidates, "Nadie lleva 14 días o más sin entrar ni responder."));

  lines.push(heading("Otros"));
  const other: string[] = [];
  other.push(a.newUsers.length ? `👋 Nuevos esta semana: ${a.newUsers.map(escapeHtml).join(", ")}.` : "👋 Nadie nuevo esta semana.");
  other.push(
    a.birthdays.length
      ? `🎂 Cumpleaños en los próximos 7 días: ${a.birthdays.map((b) => `${escapeHtml(b.name)} (${shortDate(b.date)})`).join(", ")}.`
      : "🎂 No hay cumpleaños en los próximos 7 días."
  );
  other.push(`💤 Cuentas desactivadas: ${a.inactiveAccounts}.`);
  other.push(a.sendIssues.length ? `⚠️ ${a.sendIssues.map(escapeHtml).join(" ")}` : "✅ Todos los boletines de la semana salieron bien.");
  lines.push(other.map((o) => paragraph(o, 13)).join(""));

  return lines.join("\n");
}

export function weeklyReportEmailHtml({ name, userId, report, siteUrl, isAdmin }: Args): string {
  const me = report.ranking.find((u) => u.id === userId);
  const mine = personalLine(me);
  const highlights = report.highlights
    .map(
      (h) =>
        `<tr><td style="padding:3px 8px 3px 0;font-size:16px;vertical-align:top;">${h.icon}</td><td class="text-ink" style="padding:3px 0;font-size:14px;line-height:1.5;color:${l.ink};"><strong>${escapeHtml(h.label)}:</strong> ${escapeHtml(h.text)}</td></tr>`
    )
    .join("");

  return emailWindow({
    title: isAdmin ? "📊&nbsp; Resumen semanal (admin)" : "📊&nbsp; Resumen semanal",
    width: isAdmin ? 600 : 520,
    body: `
              <p class="text-ink" style="margin:0 0 6px;color:${l.ink};font-family:${FONT_DISPLAY};font-weight:700;font-size:19px;">${escapeHtml(report.newsletterName)}</p>
              ${paragraph(`Hola ${escapeHtml(name)}, así estuvo la participación del grupo ${escapeHtml(report.periodLabel)}:`)}
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="bg-bubble" style="${flatBg(l.bubble)}border-radius:12px;margin:0 0 16px;">
                <tr><td style="padding:14px 18px;">
                  <p class="text-soft" style="margin:0;color:${l.soft};font-size:12px;font-weight:700;">Participación del grupo</p>
                  <p class="text-ink" style="margin:2px 0;color:${l.ink};font-family:${FONT_DISPLAY};font-weight:700;font-size:30px;">${pct(report.groupResponses, report.groupEligible)}</p>
                  <p class="text-soft" style="margin:0;color:${l.soft};font-size:12px;">${report.groupResponses} respuestas de ${report.groupEligible} posibles</p>
                </td></tr>
              </table>
              ${mine ? paragraph(escapeHtml(mine)) : ""}
              ${highlights ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 6px;">${highlights}</table>` : ""}
              ${heading("Los que más y los que menos")}
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${topsHtml(report.tops)}</table>
              ${heading(`⏳ ${report.threshold} días o más sin responder`)}
              ${peopleList(report.missing, "✨ Nadie. Todo el grupo ha respondido en los últimos días.")}
              ${heading(`🙈 ${report.threshold} días o más sin entrar al sitio`)}
              ${peopleList(report.absent, "✨ Nadie. Todo el grupo ha entrado en los últimos días.")}
              ${heading("Días respondidos por persona")}
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 4px;">${rankingBars(report.ranking, userId)}</table>
              ${isAdmin ? adminSection(report) : ""}
              <div style="height:22px;line-height:22px;font-size:0;">&nbsp;</div>
              ${button(siteUrl, "Ir al sitio →")}
              <p class="text-faint" style="margin:22px 0 0;color:${l.faint};font-size:12px;line-height:1.5;">Solo cuentan los días en que salió el boletín. "Entrar al sitio" es abrir la página; leer solo el correo no cuenta. MSN status: 🟢 en línea</p>`,
  });
}

export function weeklyReportEmailText({ name, userId, report, siteUrl, isAdmin }: Args): string {
  const me = report.ranking.find((u) => u.id === userId);
  const mine = personalLine(me);
  const list = (t: TopList) =>
    [
      `${t.icon} ${t.title}:`,
      ...(t.entries.length ? t.entries.map((e, i) => `  ${i + 1}. ${e.name} · ${e.label}`) : [`  ${t.empty}`]),
      ...(t.tiedMore ? [`  y ${t.tiedMore} más con lo mismo`] : []),
    ].join("\n");
  const people = (p: PersonDays[], empty: string) => (p.length ? p.map((x) => `- ${x.name}: ${x.days} días (${x.detail})`) : [empty]);

  const lines = [
    `Hola ${name}, así estuvo la participación del grupo ${report.periodLabel}:`,
    "",
    `Participación del grupo: ${pct(report.groupResponses, report.groupEligible)} (${report.groupResponses} respuestas de ${report.groupEligible} posibles)`,
    ...(mine ? ["", mine] : []),
    "",
    ...report.highlights.map((h) => `${h.icon} ${h.label}: ${h.text}`),
    "",
    ...report.tops.flatMap(([best, worst]) => [list(best), list(worst), ""]),
    `${report.threshold} días o más sin responder:`,
    ...people(report.missing, "Nadie."),
    "",
    `${report.threshold} días o más sin entrar al sitio:`,
    ...people(report.absent, "Nadie."),
    "",
    "Días respondidos por persona:",
    ...report.ranking.map((u) => `- ${u.name}: ${u.responses}/${u.eligibleDays}`),
  ];
  if (isAdmin) {
    const a = report.admin;
    lines.push(
      "",
      "--- Solo para admins ---",
      `Semana anterior: ${pct(a.previousResponses, a.previousEligible)}`,
      "Día por día:",
      ...a.daily.map((d) => `- ${shortDate(d.date)}: ${d.responded} de ${d.eligible}`),
      `Correos de inactividad: ${a.nudges.length ? a.nudges.map((n) => `${n.name} (${n.missedDays})`).join(", ") : "ninguno"}`,
      `Para pensar en desactivar: ${a.deactivateCandidates.length ? a.deactivateCandidates.map((p) => p.name).join(", ") : "nadie"}`,
      `Nuevos: ${a.newUsers.join(", ") || "nadie"}`,
      `Cumpleaños próximos: ${a.birthdays.map((b) => `${b.name} (${shortDate(b.date)})`).join(", ") || "ninguno"}`,
      `Cuentas desactivadas: ${a.inactiveAccounts}`,
      ...(a.sendIssues.length ? a.sendIssues : ["Todos los boletines salieron bien."])
    );
  }
  lines.push("", siteUrl);
  return lines.join("\n");
}
