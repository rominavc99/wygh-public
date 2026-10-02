/** Nombre a mostrar públicamente (boletín, respuestas): el usuario si está puesto, si no el nombre real. */
export function displayName(user: { name: string; username?: string | null }): string {
  return user.username?.trim() || user.name;
}
