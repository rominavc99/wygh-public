import { prisma } from "@/lib/prisma";
import { displayName } from "@/lib/display-name";
import { AddPhraseForm } from "./add-phrase-form";
import { selectPhrase, deletePhrase } from "./actions";

export default async function FrasesPage() {
  const [phrases, groups] = await Promise.all([
    prisma.phrase.findMany({ orderBy: { createdAt: "asc" }, include: { author: true } }),
    prisma.group.findMany({ orderBy: [{ suspended: "asc" }, { name: "asc" }], select: { id: true, name: true, selectedPhraseId: true } }),
  ]);

  const fixedGroups = groups.filter((g) => g.selectedPhraseId);
  const groupsFixedOn = (phraseId: string) => groups.filter((g) => g.selectedPhraseId === phraseId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold text-ink">💭 Frases</h2>
        <p className="text-sm text-ink-soft">
          {phrases.length} frase{phrases.length === 1 ? "" : "s"}. Cada día se muestra una en la portada del
          boletín de cada grupo: al azar (siempre la misma para ese día) salvo que el grupo tenga una fija. Las que
          llegan desde una respuesta solo salen en los grupos a los que se mandó esa respuesta.
        </p>
      </div>

      <AddPhraseForm />

      {fixedGroups.length ? (
        <ul className="flex flex-col gap-2">
          {fixedGroups.map((g) => (
            <li
              key={g.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-panel-edge bg-panel-2 p-3"
            >
              <p className="text-sm font-bold text-accent-pink-2">📌 {g.name} tiene una frase fija (no cambia día a día).</p>
              <form action={selectPhrase}>
                <input type="hidden" name="id" value="" />
                <input type="hidden" name="groupId" value={g.id} />
                <button type="submit" className="xp-btn-secondary">
                  🎲 Volver a modo aleatorio
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-soft">🎲 Modo aleatorio en todos los grupos: cada día se elige sola una frase distinta.</p>
      )}

      <ul className="flex flex-col gap-2">
        {phrases.map((phrase) => {
          const fixedOn = groupsFixedOn(phrase.id);
          const available = groups.filter((g) => g.selectedPhraseId !== phrase.id);
          return (
            <li
              key={phrase.id}
              className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${
                fixedOn.length ? "border-accent-pink bg-panel" : "border-panel-edge bg-panel-2"
              }`}
            >
              <div>
                <p className="text-ink">
                  &quot;{phrase.text}&quot;
                  {fixedOn.map((g) => (
                    <span key={g.id} className="chip chip-pink ml-2 align-middle">
                      Fija en {g.name}
                    </span>
                  ))}
                </p>
                {phrase.author ? (
                  <p className="text-xs text-ink-faint">
                    Enviada por {displayName(phrase.author)}
                    {phrase.date ? ` para el ${phrase.date}` : ""}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {available.length ? (
                  <form action={selectPhrase} className="flex gap-2">
                    <input type="hidden" name="id" value={phrase.id} />
                    {available.length === 1 ? (
                      <input type="hidden" name="groupId" value={available[0].id} />
                    ) : (
                      <select name="groupId" className="xp-select text-sm" aria-label="Grupo">
                        {available.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                    )}
                    <button type="submit" className="xp-btn-secondary">
                      {groups.length > 1 ? "Fijar en" : "Usar esta"}
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
        {phrases.length === 0 ? <p className="text-sm text-ink-soft">Todavía no hay frases registradas.</p> : null}
      </ul>
    </div>
  );
}
