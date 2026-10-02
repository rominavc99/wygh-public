function hashString(value: string): number {
  let hash = 0;
  for (const ch of value) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return hash;
}

/** Elige un elemento de la lista de forma determinística según `seed` (ej. la fecha) — misma entrada, mismo resultado siempre. */
export function pickStable<T>(items: T[], seed: string): T {
  return items[hashString(seed) % items.length];
}
