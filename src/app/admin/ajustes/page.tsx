import { prisma } from "@/lib/prisma";
import { todayLocalDate } from "@/lib/date";
import { displayName } from "@/lib/display-name";
import { manualRecipients } from "@/lib/send-now";
import { SettingsForm } from "./settings-form";

export default async function AjustesPage() {
  const today = todayLocalDate();
  const [settings, users, weekly, nudge, streak, onThisDay, anniversary, wrapped] = await Promise.all([
    prisma.settings.upsert({
      where: { id: 1 },
      create: { id: 1 },
      update: {},
    }),
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    manualRecipients("weekly", today),
    manualRecipients("nudge", today),
    manualRecipients("streak", today),
    manualRecipients("on-this-day", today),
    manualRecipients("anniversary", today),
    manualRecipients("wrapped", today),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold text-ink">⚙️ Ajustes</h2>
        <p className="text-sm text-ink-soft">Configuración del boletín y del envío automático.</p>
      </div>
      <SettingsForm
        settings={settings}
        users={users.map((u) => ({ id: u.id, name: displayName(u) }))}
        sendNow={{ weekly, nudge, streak, "on-this-day": onThisDay, anniversary, wrapped }}
      />
    </div>
  );
}
