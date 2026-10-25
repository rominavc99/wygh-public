import { redirect } from "next/navigation";

/** El historial ahora vive en el perfil (pestañas Resúmenes / Al llegar a casa). */
export default function MisRespuestasPage() {
  redirect("/perfil");
}
