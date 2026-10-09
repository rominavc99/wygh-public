/**
 * Duración de las sesiones. Aparte de auth.ts para que el worker (que no
 * carga next-auth) pueda usarla en src/lib/last-seen.ts.
 */
export const SESSION_MAX_AGE_SECONDS = 90 * 24 * 60 * 60; // 90 días
