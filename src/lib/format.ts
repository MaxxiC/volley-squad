// Formattazione date in italiano, sempre nel fuso di Bologna (il server Vercel gira in UTC).

const TIME_ZONE = "Europe/Rome";

function dateParts(iso: string, options: Intl.DateTimeFormatOptions) {
  const parts = new Intl.DateTimeFormat("it-IT", { timeZone: TIME_ZONE, ...options }).formatToParts(new Date(iso));
  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Sab 31 ott" */
export function formatShortDate(iso: string) {
  const p = dateParts(iso, { weekday: "short", day: "numeric", month: "short" });
  return `${capitalize(p.weekday)} ${p.day} ${p.month}`;
}

/** "Dom 25 ottobre" */
export function formatDayMonth(iso: string) {
  const p = dateParts(iso, { weekday: "short", day: "numeric", month: "long" });
  return `${capitalize(p.weekday)} ${p.day} ${p.month}`;
}

/** "Sabato 31 ottobre" */
export function formatLongDate(iso: string) {
  const p = dateParts(iso, { weekday: "long", day: "numeric", month: "long" });
  return `${capitalize(p.weekday)} ${p.day} ${p.month}`;
}

/** "21:00" */
export function formatTime(iso: string) {
  const p = dateParts(iso, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return `${p.hour}:${p.minute}`;
}

/** Giorno e mese breve per il box data: { day: "31", month: "ott" } */
export function dateBox(iso: string) {
  const p = dateParts(iso, { day: "numeric", month: "short" });
  return { day: p.day, month: p.month };
}
