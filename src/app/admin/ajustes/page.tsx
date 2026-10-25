import { prisma } from "@/lib/prisma";
import { addDaysLocal, formatLocalDate, todayLocalDate } from "@/lib/date";
import { displayName } from "@/lib/display-name";
import { getSiteUrl } from "@/lib/site-url";
import { manualRecipients } from "@/lib/send-now";
import { capitalize } from "@/lib/newsletter";
import { EXTRAORDINARY_PATH } from "@/lib/extraordinary";
import { SettingsForm } from "./settings-form";
import { ExtraordinarySection } from "./extraordinary-section";

export default async function AjustesPage() {
  const today = todayLocalDate();
  const [settings, users, weekly, nudge, missed, streak, onThisDay, anniversary, wrapped, grants] = await Promise.all([
    prisma.settings.upsert({
      where: { id: 1 },
      create: { id: 1 },
      update: {},
    }),
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    manualRecipients("weekly", today),
    manualRecipients("nudge", today),
    manualRecipients("missed", today),
    manualRecipients("streak", today),
    manualRecipients("on-this-day", today),
    manualRecipients("anniversary", today),
    manualRecipients("wrapped", today),
    prisma.extraordinaryGrant.findMany({
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);
  const userOptions = users.map((u) => ({ id: u.id, name: displayName(u) }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold text-ink">⚙️ Ajustes</h2>
        <p className="text-sm text-ink-soft">Configuración del boletín y del envío automático.</p>
      </div>
      <SettingsForm
        settings={settings}
        users={userOptions}
        sendNow={{ weekly, nudge, missed, streak, "on-this-day": onThisDay, anniversary, wrapped }}
      />
      <ExtraordinarySection
        enabled={settings.extraordinaryResponsesEnabled}
        url={`${getSiteUrl()}${EXTRAORDINARY_PATH}`}
        users={userOptions}
        yesterday={addDaysLocal(today, -1)}
        grants={grants.map((g) => ({
          id: g.id,
          userName: displayName(g.user),
          date: g.date,
          dateLabel: capitalize(formatLocalDate(g.date)),
          notifiedAt: g.notifiedAt?.toISOString() ?? null,
          usedAt: g.usedAt?.toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) ?? null,
        }))}
      />
    </div>
  );
}
