import { ApiError, badRequest } from "@/lib/api/http";

// Piezas comunes de /api/v1/admin. Esos endpoints reutilizan las Server
// Actions del panel (src/app/admin/**/actions.ts), que reciben FormData y
// aceptan el token de la app (ver requireUser en src/lib/auth-guards.ts):
// aquí se arma el FormData y se traduce lo que devuelven a HTTP.

/**
 * JSON → FormData como lo mandaría el formulario del panel: textos y
 * números tal cual, `true` como checkbox marcado ("on"), `false` se omite
 * (checkbox sin marcar) y los arreglos como campos repetidos.
 */
export function formOf(fields: Record<string, unknown>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null || value === false) continue;
    if (value === true) form.set(key, "on");
    else if (Array.isArray(value)) for (const v of value) form.append(key, String(v));
    else form.set(key, String(value));
  }
  return form;
}

/** Lo guardado con encima solo las llaves de `keys` que vengan en el cuerpo (semántica de PATCH). */
export function overlay<T extends Record<string, unknown>>(current: T, body: Record<string, unknown>, keys: readonly (keyof T & string)[]): T {
  const merged = { ...current };
  for (const key of keys) if (key in body) (merged as Record<string, unknown>)[key] = body[key];
  return merged;
}

type ActionState =
  | { status: "idle" }
  | { status: "success"; message?: string }
  | { status: "error"; message?: string; fieldErrors?: Record<string, string> }
  | { status: "done"; ok: boolean; message: string };

/** 400 con `fields` si la acción rechazó los datos; 409 si respondió "done" sin éxito. */
export function checkState<S extends ActionState>(state: S): S {
  if (state.status === "error") throw badRequest(state.message ?? "Revisa los campos marcados.", state.fieldErrors);
  if (state.status === "done" && !state.ok) throw new ApiError(409, "not_allowed", state.message);
  return state;
}

export function message(state: ActionState): string | null {
  return "message" in state && state.message ? state.message : null;
}

export const IDLE = { status: "idle" } as const;

/** 400 si `date` no es "YYYY-MM-DD". */
export function checkDate(date: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw badRequest('La fecha tiene que ser "YYYY-MM-DD".');
}
