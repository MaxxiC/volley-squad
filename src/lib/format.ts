// Formattazione date in italiano, sempre nel fuso di Bologna (il server Vercel gira in UTC).

const TIME_ZONE = "Europe/Rome";

function dateParts(date: Date, options: Intl.DateTimeFormatOptions) {
  const parts = new Intl.DateTimeFormat("it-IT", { timeZone: TIME_ZONE, ...options }).formatToParts(date);
  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Sab 31 ott" */
export function formatShortDate(date: Date) {
  const p = dateParts(date, { weekday: "short", day: "numeric", month: "short" });
  return `${capitalize(p.weekday)} ${p.day} ${p.month}`;
}

/** "Dom 25 ottobre" */
export function formatDayMonth(date: Date) {
  const p = dateParts(date, { weekday: "short", day: "numeric", month: "long" });
  return `${capitalize(p.weekday)} ${p.day} ${p.month}`;
}

/** "Sabato 31 ottobre" */
export function formatLongDate(date: Date) {
  const p = dateParts(date, { weekday: "long", day: "numeric", month: "long" });
  return `${capitalize(p.weekday)} ${p.day} ${p.month}`;
}

/** "21:00" */
export function formatTime(date: Date) {
  const p = dateParts(date, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return `${p.hour}:${p.minute}`;
}

/** Valore per <input type="date">: "2026-10-31" */
export function toDateInput(date: Date) {
  const p = dateParts(date, { year: "numeric", month: "2-digit", day: "2-digit" });
  return `${p.year}-${p.month}-${p.day}`;
}

/** Valore per <input type="time">: "21:00" */
export const toTimeInput = formatTime;

/** Da data e ora inserite (ora di Bologna) all'istante UTC, gestendo l'ora legale. */
export function fromRomeInput(date: string, time: string) {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  const offsetAt = (ts: number) => {
    const p = dateParts(new Date(ts), {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23",
    });
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - ts;
  };
  // Due passaggi: il secondo corregge i casi a cavallo del cambio d'ora.
  const first = wall - offsetAt(wall);
  return new Date(wall - offsetAt(first));
}

/** Giorno e mese breve per il box data: { day: "31", month: "ott" } */
export function dateBox(date: Date) {
  const p = dateParts(date, { day: "numeric", month: "short" });
  return { day: p.day, month: p.month };
}
