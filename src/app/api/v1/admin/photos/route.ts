import { syncHeroPhotos } from "@/lib/hero-photos";
import { handler, json, requireApiAdmin } from "@/lib/api/http";
import { photoUrl } from "@/lib/api/dto";

/** GET /api/v1/admin/photos — las fotos que puede usar la portada (las de public/IMG y las que llegan con los resúmenes). */
export const GET = handler(async (request: Request) => {
  await requireApiAdmin(request);
  const photos = await syncHeroPhotos();
  return json({ photos: photos.map((p) => ({ id: p.id, url: photoUrl(p.filename), filename: p.filename, description: p.description, date: p.date, authorName: p.authorName })) });
});
