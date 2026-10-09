/** Fecha local del servidor en formato "YYYY-MM-DD" (no UTC). */
export function todayLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** El día calendario anterior a `date` ("YYYY-MM-DD"), en formato "YYYY-MM-DD". */
export function previousLocalDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, m - 1, d - 1);
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatLocalDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("es-ES", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** "HH:MM" local del servidor, para comparar contra Settings.sendTime. */
export function nowLocalTime(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

/** Valor para un <input type="datetime-local"> ("YYYY-MM-DDTHH:MM"), hora local del servidor. */
export function toLocalDatetimeInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Resta minutos a una hora "HH:MM", dando la vuelta si cruza medianoche. */
export function subtractMinutesFromTime(time: string, minutesToSubtract: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = (h * 60 + m - minutesToSubtract + 24 * 60) % (24 * 60);
  const hours = String(Math.floor(total / 60)).padStart(2, "0");
  const minutes = String(total % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * El día ("YYYY-MM-DD") en que se celebra en `year` un cumpleaños
 * `birthday` ("YYYY-MM-DD", solo importan mes y día). Quien nació un 29 de
 * febrero lo celebra el 28 en años no bisiestos.
 */
export function birthdayInYear(birthday: string, year: number): string {
  const monthDay = birthday.slice(5);
  if (monthDay === "02-29" && !isLeapYear(year)) return `${year}-02-28`;
  return `${year}-${monthDay}`;
}

/** true si `date` ("YYYY-MM-DD") es el día en que se celebra `birthday`. */
export function isBirthdayOn(birthday: string, date: string): boolean {
  return birthdayInYear(birthday, Number(date.slice(0, 4))) === date;
}

/** Próximo día (hoy incluido) en que se celebra `birthday`, a partir de `from`. */
export function nextBirthdayDate(birthday: string, from: string): string {
  const year = Number(from.slice(0, 4));
  const thisYear = birthdayInYear(birthday, year);
  return thisYear >= from ? thisYear : birthdayInYear(birthday, year + 1);
}

/** El mismo día un año antes de `date` (el 29 de febrero cae en el 28). */
export function oneYearBefore(date: string): string {
  return birthdayInYear(date, Number(date.slice(0, 4)) - 1);
}

/** Fecha local ("YYYY-MM-DD") de un instante, en la zona del servidor. */
export function localDateOf(instant: Date): string {
  const year = instant.getFullYear();
  const month = String(instant.getMonth() + 1).padStart(2, "0");
  const day = String(instant.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** `date` ("YYYY-MM-DD") más `days` días calendario (negativo para restar). */
export function addDaysLocal(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return localDateOf(new Date(y, m - 1, d + days));
}

/** Día de la semana de `date` ("YYYY-MM-DD"), como Date.getDay(): 0 = domingo. */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

/** Días calendario de `from` a `to` ("YYYY-MM-DD"); negativo si `to` es antes. */
export function daysBetween(from: string, to: string): number {
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}
