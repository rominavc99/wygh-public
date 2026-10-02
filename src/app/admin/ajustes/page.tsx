import { prisma } from "@/lib/prisma";
import { SettingsForm } from "./settings-form";

export default async function AjustesPage() {
  const settings = await prisma.settings.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold text-ink">⚙️ Ajustes</h2>
        <p className="text-sm text-ink-soft">Configuración del boletín y del envío automático.</p>
      </div>
      <SettingsForm settings={settings} />
    </div>
  );
}
