import { syncHeroPhotos } from "@/lib/hero-photos";
import { PhotoCard } from "./photo-card";

export default async function FotosPage() {
  const photos = await syncHeroPhotos();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold text-ink">🖼️ Fotos</h2>
        <p className="text-sm text-ink-soft">
          {photos.length} foto{photos.length === 1 ? "" : "s"} en <code>public/IMG</code>. Si
          la portada del boletín no tiene una foto puesta a mano en Ajustes, se usa una de
          acá: la que tenga la fecha de ese día, o si ninguna la tiene, una al azar (siempre
          la misma para ese día).
        </p>
      </div>

      {photos.length === 0 ? (
        <p className="text-sm text-ink-soft">
          No hay fotos todavía. Copia imágenes (.jpg, .png, .webp, .gif) a la carpeta{" "}
          <code>public/IMG</code> del proyecto y recarga esta página.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((photo) => (
            <PhotoCard key={photo.id} photo={photo} />
          ))}
        </ul>
      )}
    </div>
  );
}
