import { prisma } from "@/lib/prisma";
import { displayName } from "@/lib/display-name";
import { AddPhraseForm } from "./add-phrase-form";
import { selectPhrase, deletePhrase } from "./actions";

export default async function FrasesPage() {
  const [phrases, settings] = await Promise.all([
    prisma.phrase.findMany({ orderBy: { createdAt: "asc" }, include: { author: true } }),
    prisma.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} }),
  ]);

  const selectedId = settings.selectedPhraseId;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold text-ink">💭 Frases</h2>
        <p className="text-sm text-ink-soft">
          {phrases.length} frase{phrases.length === 1 ? "" : "s"}. Cada día se muestra una en
          la portada del boletín: al azar (siempre la misma para ese día) salvo que elijas una
          a mano abajo.
        </p>
      </div>

      <AddPhraseForm />

      {selectedId ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-panel-edge bg-panel-2 p-3">
          <p className="text-sm font-bold text-accent-pink-2">
            📌 Tienes una frase fija puesta a mano (no cambia día a día).
          </p>
          <form action={selectPhrase}>
            <input type="hidden" name="id" value="" />
            <button type="submit" className="xp-btn-secondary">
              🎲 Volver a modo aleatorio
            </button>
          </form>
        </div>
      ) : (
        <p className="text-sm text-ink-soft">
          🎲 Modo aleatorio activo: cada día se elige sola una frase distinta.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {phrases.map((phrase) => {
          const isSelected = phrase.id === selectedId;
          return (
            <li
              key={phrase.id}
              className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${
                isSelected ? "border-accent-pink bg-panel" : "border-panel-edge bg-panel-2"
              }`}
            >
              <div>
                <p className="text-ink">
                  &quot;{phrase.text}&quot;
                  {isSelected ? <span className="chip chip-pink ml-2 align-middle">Fija</span> : null}
                </p>
                {phrase.author ? (
                  <p className="text-xs text-ink-faint">
                    Enviada por {displayName(phrase.author)}
                    {phrase.date ? ` para el ${phrase.date}` : ""}
                  </p>
                ) : null}
              </div>
              <div className="flex gap-2">
                {!isSelected ? (
                  <form action={selectPhrase}>
                    <input type="hidden" name="id" value={phrase.id} />
                    <button type="submit" className="xp-btn-secondary">
                      Usar esta
                    </button>
                  </form>
                ) : null}
                <form action={deletePhrase}>
                  <input type="hidden" name="id" value={phrase.id} />
                  <button type="submit" className="xp-btn-danger">
                    Borrar
                  </button>
                </form>
              </div>
            </li>
          );
        })}
        {phrases.length === 0 ? (
          <p className="text-sm text-ink-soft">Todavía no hay frases registradas.</p>
        ) : null}
      </ul>
    </div>
  );
}
